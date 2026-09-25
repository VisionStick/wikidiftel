import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBztc4ll_GsLPnOwdh5dAV2CaZB3806Wx0",
  authDomain: "diftel-jbbg.firebaseapp.com",
  databaseURL: "https://diftel-jbbg-default-rtdb.firebaseio.com",
  projectId: "diftel-jbbg",
  storageBucket: "diftel-jbbg.firebasestorage.app",
  messagingSenderId: "779953003328",
  appId: "1:779953003328:web:6679dfc860989976d9b8a5"
};

const ADMIN_UID = "heOTF34u5qYzqrPi3qM1h4BavlP2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginFeedback = document.getElementById("loginFeedback");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const messagesList = document.getElementById("messagesList");
const totalStat = document.getElementById("totalStat");
const transitStat = document.getElementById("transitStat");
const deliveredStat = document.getElementById("deliveredStat");
const timeFilter = document.getElementById("timeFilter");
const statusFilter = document.getElementById("statusFilter");
const filterCount = document.getElementById("filterCount");

const adminStyle=document.createElement('style');
adminStyle.textContent=`
  .network-data{display:flex;flex-wrap:wrap;gap:6px;margin:11px 0 0}.network-chip{padding:5px 7px;border-radius:6px;background:#f3f7f9;border:1px solid #dbe5ed;font:9px JetBrains Mono,monospace;color:#526b7d}.network-chip b{color:#18364a}
`;
document.head.appendChild(adminStyle);

let latestMessages = {};
let unsubscribeMessages = null;

function escapeHtml(value = "") {return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

function humanAuthError(error){
  const code=error?.code||'';
  const map={
    'auth/invalid-credential':'Correo o contraseña incorrectos.','auth/user-not-found':'Ese correo no existe en Firebase Authentication.','auth/wrong-password':'La contraseña no coincide con ese usuario.','auth/invalid-email':'El correo tiene un formato inválido.','auth/user-disabled':'La cuenta administradora está deshabilitada.','auth/operation-not-allowed':'Debes activar Correo/Contraseña en Firebase → Authentication → Sign-in method.','auth/too-many-requests':'Firebase bloqueó temporalmente nuevos intentos. Espera un momento y prueba de nuevo.','auth/network-request-failed':'No se pudo contactar Firebase. Revisa tu conexión.','auth/unauthorized-domain':'Agrega visionstick.github.io en Firebase → Authentication → Settings → Authorized domains.','auth/api-key-not-valid.-please-pass-a-valid-api-key.':'La API key configurada no es válida.'
  };
  return map[code]||`Firebase respondió: ${code||error?.message||'error desconocido'}`;
}

function formatStatus(status){return status==="Entregado"?"Entregado":"En tránsito";}
function shortMessageNumber(id="",item={}){return item?.messageNumber||id.slice(-6).toUpperCase()||"------";}
function formatDateTime(timestamp){if(!timestamp)return"Fecha no registrada";return new Date(timestamp).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});}
function formatDuration(start,end){
  if(!start||!end||end<start)return"";
  const totalSeconds=Math.max(0,Math.round((end-start)/1000));const hours=Math.floor(totalSeconds/3600);const minutes=Math.floor((totalSeconds%3600)/60);const seconds=totalSeconds%60;
  if(hours>0)return`${hours} h ${String(minutes).padStart(2,"0")} min ${String(seconds).padStart(2,"0")} s`;
  if(minutes>0)return`${minutes} min ${String(seconds).padStart(2,"0")} s`;
  return`${seconds} s`;
}

function passesTimeFilter(item){
  const value=timeFilter?.value||"all";if(value==="all")return true;if(!item?.createdAt)return false;
  const windows={"15m":15*60*1000,"1h":60*60*1000,"24h":24*60*60*1000,"7d":7*24*60*60*1000};
  return Date.now()-item.createdAt<=windows[value];
}
function passesStatusFilter(item){const value=statusFilter?.value||"all";if(value==="all")return true;if(value==="delivered")return item?.status==="Entregado";if(value==="transit")return item?.status!=="Entregado";return true;}
function sortedEntries(){return Object.entries(latestMessages||{}).sort((a,b)=>(b[1]?.createdAt||0)-(a[1]?.createdAt||0));}

function renderMessages(){
  const allEntries=sortedEntries();const total=allEntries.length;const delivered=allEntries.filter(([,item])=>item?.status==="Entregado").length;const transit=total-delivered;
  totalStat.textContent=total;transitStat.textContent=transit;deliveredStat.textContent=delivered;
  const entries=allEntries.filter(([,item])=>passesTimeFilter(item)&&passesStatusFilter(item));
  if(filterCount)filterCount.textContent=`${entries.length} ${entries.length===1?"visible":"visibles"}`;
  if(!entries.length){messagesList.innerHTML='<div class="empty">No hay mensajes que coincidan con los filtros.</div>';return;}

  messagesList.innerHTML=entries.map(([id,item])=>{
    const status=formatStatus(item?.status);const deliveredClass=status==="Entregado"?" delivered":"";const number=shortMessageNumber(id,item);const created=formatDateTime(item?.createdAt);const deliveredAt=item?.deliveredAt?formatDateTime(item.deliveredAt):null;const duration=item?.deliveredAt?formatDuration(item?.createdAt,item.deliveredAt):"";
    const timeDetail=status==="Entregado"?`<span class="msg-meta delivery-time">Entregado: ${escapeHtml(deliveredAt||"sin hora")} ${duration?`· aceptación ${escapeHtml(duration)}`:""}</span>`:`<span class="msg-meta transit-time">Recibido: ${escapeHtml(created)}</span>`;
    const deliveryButton=status==="Entregado"?'<span class="msg-meta">Mensaje finalizado</span>':`<button class="btn secondary deliver-btn" data-id="${escapeHtml(id)}">Marcar como entregado</button>`;
    const netChips=[
      `<span class="network-chip"><b>Protocolo</b> ${escapeHtml(item?.protocol||"N/A")}</span>`,
      item?.browserRttMs!=null?`<span class="network-chip"><b>RTT aprox.</b> ${escapeHtml(item.browserRttMs)} ms</span>`:'',
      item?.effectiveType&&item.effectiveType!=="no disponible"?`<span class="network-chip"><b>Red</b> ${escapeHtml(item.effectiveType)}</span>`:'',
      item?.downlinkMbps!=null?`<span class="network-chip"><b>Bajada</b> ${escapeHtml(item.downlinkMbps)} Mbps</span>`:''
    ].join('');

    return `<article class="msg">
      <div class="msg-top"><div><div class="msg-title-row"><strong>${escapeHtml(item?.name||"Sin nombre")}</strong><span class="message-number">#${escapeHtml(number)}</span></div><div class="msg-meta">${escapeHtml(created)} · ID ${escapeHtml(id)}</div><div class="network-data">${netChips}</div></div><span class="status${deliveredClass}">${status}</span></div>
      <div class="msg-body">${escapeHtml(item?.message||"")}</div>
      <div class="msg-actions"><div>${timeDetail}</div><div class="action-buttons">${deliveryButton}<button class="btn danger delete-btn" data-id="${escapeHtml(id)}" data-number="${escapeHtml(number)}">Eliminar</button></div></div>
    </article>`;
  }).join("");

  document.querySelectorAll(".deliver-btn").forEach(button=>button.addEventListener("click",async()=>{
    const id=button.dataset.id;button.disabled=true;button.textContent="Actualizando…";
    try{await update(ref(db,`messages/${id}`),{status:"Entregado",deliveredAt:Date.now()});}
    catch(error){console.error(error);button.disabled=false;button.textContent="Reintentar";alert("No se pudo actualizar el mensaje. Revisa las reglas de Realtime Database.");}
  }));

  document.querySelectorAll(".delete-btn").forEach(button=>button.addEventListener("click",async()=>{
    const id=button.dataset.id,number=button.dataset.number;if(!window.confirm(`¿Eliminar definitivamente el mensaje #${number}? Esta acción no se puede deshacer.`))return;
    button.disabled=true;button.textContent="Eliminando…";
    try{await remove(ref(db,`messages/${id}`));}
    catch(error){console.error(error);button.disabled=false;button.textContent="Reintentar";alert("No se pudo eliminar. Debes permitir el borrado al administrador en las reglas de Realtime Database.");}
  }));
}

function watchMessages(){if(unsubscribeMessages)unsubscribeMessages();unsubscribeMessages=onValue(ref(db,"messages"),snapshot=>{latestMessages=snapshot.val()||{};renderMessages();},error=>{console.error(error);messagesList.innerHTML=`<div class="empty">No se pudieron leer los mensajes: ${escapeHtml(error.code||error.message)}</div>`;});}
function showDashboard(){loginCard.style.display="none";dashboard.style.display="block";watchMessages();}
function showLogin(){dashboard.style.display="none";loginCard.style.display="block";latestMessages={};if(unsubscribeMessages){unsubscribeMessages();unsubscribeMessages=null;}}

loginForm.addEventListener("submit",async event=>{
  event.preventDefault();loginFeedback.textContent="Conectando con Firebase…";loginFeedback.style.color='#167fa3';loginBtn.disabled=true;loginBtn.textContent="Verificando…";
  try{
    const credential=await signInWithEmailAndPassword(auth,document.getElementById("email").value.trim(),document.getElementById("password").value);
    if(credential.user.uid!==ADMIN_UID){const actualUid=credential.user.uid;await signOut(auth);loginFeedback.textContent=`El correo y contraseña son válidos, pero este usuario no es el administrador configurado. UID detectado: ${actualUid}`;loginFeedback.style.color='#b47a19';return;}
    loginFeedback.textContent="Acceso correcto.";loginFeedback.style.color='#1f9d67';
  }catch(error){console.error('Firebase Auth:',error.code,error.message);loginFeedback.textContent=humanAuthError(error);loginFeedback.style.color='#bf4e54';}
  finally{loginBtn.disabled=false;loginBtn.textContent="Ingresar";}
});

logoutBtn.addEventListener("click",()=>signOut(auth));refreshBtn.addEventListener("click",renderMessages);timeFilter?.addEventListener("change",renderMessages);statusFilter?.addEventListener("change",renderMessages);
onAuthStateChanged(auth,async user=>{if(user&&user.uid===ADMIN_UID)showDashboard();else{if(user)await signOut(auth);showLogin();}});
