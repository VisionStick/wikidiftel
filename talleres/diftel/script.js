const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const packet = document.getElementById('packet');
const simState = document.getElementById('simState');
const eventList = document.getElementById('eventList');
const destinationLabel = document.getElementById('destinationLabel');
const originLabel = document.getElementById('originLabel');
const protocol = document.getElementById('protocol');
const cards = document.querySelectorAll('.device-card');
const nodes = document.querySelectorAll('.node');

const protocolOptions = [
  ['ICMP','ICMP · Ping / diagnóstico'],
  ['TCP','TCP · Transporte confiable'],
  ['UDP','UDP · Datagrama rápido'],
  ['HTTP','HTTP · Web'],
  ['HTTPS','HTTPS · Web segura'],
  ['DNS','DNS · Resolución de nombres'],
  ['DHCP','DHCP · Asignación de IP'],
  ['FTP','FTP · Transferencia de archivos'],
  ['SMTP','SMTP · Correo electrónico'],
  ['SSH','SSH · Acceso remoto'],
  ['ARP','ARP · Resolución IP/MAC'],
  ['ETHERNET','Ethernet · Trama LAN']
];

const protocolProfiles = {
  ICMP:{base:10,hop:3,jitter:2,note:'ICMP sirve para probar si un equipo responde en la red.'},
  TCP:{base:24,hop:5,jitter:4,note:'TCP prioriza que el mensaje llegue completo y ordenado.'},
  UDP:{base:12,hop:3,jitter:6,note:'UDP prioriza rapidez, aunque no confirma cada entrega.'},
  HTTP:{base:34,hop:5,jitter:7,note:'HTTP permite pedir y recibir información de una página web.'},
  HTTPS:{base:46,hop:6,jitter:8,note:'HTTPS hace lo mismo que HTTP, pero usando cifrado.'},
  DNS:{base:20,hop:4,jitter:5,note:'DNS traduce un nombre de página a una dirección IP.'},
  DHCP:{base:29,hop:5,jitter:7,note:'DHCP entrega una configuración de red automáticamente.'},
  FTP:{base:42,hop:6,jitter:8,note:'FTP se usa para mover archivos entre equipos.'},
  SMTP:{base:39,hop:5,jitter:7,note:'SMTP participa en el envío de correos electrónicos.'},
  SSH:{base:36,hop:5,jitter:5,note:'SSH permite acceder a un equipo de forma remota y segura.'},
  ARP:{base:8,hop:2,jitter:2,note:'ARP ayuda a encontrar la dirección física de un equipo en la red local.'},
  ETHERNET:{base:5,hop:1,jitter:1,note:'Ethernet representa la comunicación dentro de una red local cableada.'}
};

protocol.innerHTML = protocolOptions.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');

const protocolHelp = document.createElement('p');
protocolHelp.className = 'protocol-help';
protocolHelp.innerHTML = '<strong>Dato:</strong> el protocolo define cómo viaja la información; el cable solo es el camino físico.';
protocol.insertAdjacentElement('afterend', protocolHelp);

const helperStyle = document.createElement('style');
helperStyle.textContent = `
  .protocol-help{margin:9px 0 0;color:#71899a;font-size:9px;line-height:1.45}
  .protocol-help strong{color:#375a70}
  .sim-telemetry{grid-template-columns:repeat(5,minmax(76px,1fr))!important}
  @media(max-width:820px){.sim-telemetry{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
  @media(max-width:520px){.sim-telemetry{grid-template-columns:1fr!important}}
`;
document.head.appendChild(helperStyle);

const rawLines = [...document.querySelectorAll('.links line')];
['pc1-r1','r1-sw1','r1-ap','sw1-srv'].forEach((name,index)=>{
  if(rawLines[index]) rawLines[index].dataset.link=name;
});
const linkLines = document.querySelectorAll('.links line[data-link]');

let telemetry = document.querySelector('.sim-telemetry');
if(!telemetry){
  telemetry = document.createElement('div');
  telemetry.className='sim-telemetry';
  telemetry.innerHTML=`
    <div><small>PROTOCOLO</small><strong id="packetProtocol">${protocol.options[protocol.selectedIndex].textContent}</strong></div>
    <div><small>SALTOS</small><strong id="hopLabel">0 saltos</strong></div>
    <div><small>TIEMPO SIM.</small><strong id="simLatency">—</strong></div>
    <div><small>VARIACIÓN</small><strong id="simJitter">—</strong></div>
    <div><small>ESTADO</small><strong id="packetStatus">Preparado</strong></div>`;
  document.querySelector('.sim-controls')?.prepend(telemetry);
}
const hopLabel = document.getElementById('hopLabel');
const packetProtocol = document.getElementById('packetProtocol');
const packetStatus = document.getElementById('packetStatus');
const simLatency = document.getElementById('simLatency');
const simJitter = document.getElementById('simJitter');

const devicePanel = document.querySelector('.device-panel');
let routeChooser = document.getElementById('routeChooser');
if(!routeChooser && devicePanel){
  routeChooser = document.createElement('div');
  routeChooser.id='routeChooser';
  routeChooser.className='route-chooser';
  routeChooser.innerHTML=`
    <div class="panel-divider"></div>
    <div class="panel-title">RUTA</div>
    <label class="select-label" for="originSelect">Origen</label>
    <select id="originSelect">
      <option value="pc1">PC Cliente</option>
      <option value="srv">Servidor</option>
      <option value="ap">Access Point</option>
    </select>
    <label class="select-label route-destination-label" for="destinationSelect">Destino</label>
    <select id="destinationSelect">
      <option value="srv">Servidor</option>
      <option value="ap">Access Point</option>
      <option value="pc1">PC Cliente</option>
    </select>`;
  devicePanel.insertBefore(routeChooser, devicePanel.querySelector('.panel-divider'));
}
const originSelect = document.getElementById('originSelect');
const destinationSelect = document.getElementById('destinationSelect');

document.querySelectorAll('a[href="https://diftel.josnic.cl/"]').forEach(link=>{
  const strong=link.querySelector('strong');
  if(strong) strong.textContent='Página DIFTEL';
  if(link.classList.contains('btn')) link.textContent='Visitar página DIFTEL';
});

let origin = 'pc1';
let destination = 'srv';
let running = false;
let generation = 0;

const positions = {
  pc1: {x:12,y:23},
  r1: {x:37,y:46},
  sw1: {x:62,y:22},
  srv: {x:82,y:44},
  ap: {x:67,y:70}
};

const graph = {
  pc1:['r1'],
  r1:['pc1','sw1','ap'],
  sw1:['r1','srv'],
  srv:['sw1'],
  ap:['r1']
};

const linkMap = {
  'pc1-r1': 'pc1-r1','r1-pc1': 'pc1-r1',
  'r1-sw1': 'r1-sw1','sw1-r1': 'r1-sw1',
  'sw1-srv': 'sw1-srv','srv-sw1': 'sw1-srv',
  'r1-ap': 'r1-ap','ap-r1': 'r1-ap'
};

function getNode(id){ return document.getElementById(id); }
function nodeName(id){ return getNode(id)?.dataset.name || id; }

function shortestRoute(start,end){
  if(start===end) return [start];
  const queue=[[start]];
  const visited=new Set([start]);
  while(queue.length){
    const path=queue.shift();
    const last=path[path.length-1];
    for(const next of graph[last]||[]){
      if(visited.has(next)) continue;
      const newPath=[...path,next];
      if(next===end) return newPath;
      visited.add(next);
      queue.push(newPath);
    }
  }
  return [];
}

function simulatedMetrics(route){
  const profile = protocolProfiles[protocol.value] || protocolProfiles.ICMP;
  const hops = Math.max(route.length - 1, 1);
  const variation = Math.max(1, Math.round(Math.random() * profile.jitter));
  const direction = Math.random() > .5 ? 1 : -1;
  const latency = Math.max(1, Math.round(profile.base + profile.hop * hops + direction * variation));
  return {latency, jitter:variation, profile};
}

function wait(ms, token){
  return new Promise((resolve,reject)=>setTimeout(()=>token===generation?resolve():reject(new Error('simulation-cancelled')),ms));
}

function addEvent(number,title,text,type='normal'){
  const item=document.createElement('div');
  item.className=`event ${type}`;
  item.innerHTML=`<span>${String(number).padStart(2,'0')}</span><p><strong>${title}</strong><small>${text}</small></p>`;
  eventList.appendChild(item);
  eventList.scrollTop=eventList.scrollHeight;
}

function clearSelection(){
  nodes.forEach(node=>node.classList.remove('selected'));
  cards.forEach(card=>card.classList.remove('active'));
}

function clearRouteHighlights(){
  linkLines.forEach(line=>line.classList.remove('route-active','route-done','route-return'));
  nodes.forEach(node=>node.classList.remove('hop-active','hop-done','hop-return'));
}

function getLink(a,b){
  const key=linkMap[`${a}-${b}`];
  return key?document.querySelector(`.links line[data-link="${key}"]`):null;
}

function setPacketAt(id){
  const p=positions[id];
  packet.style.transition='none';
  packet.style.left=p.x+'%';
  packet.style.top=p.y+'%';
}

function updateRouteUI(){
  generation+=1;
  running=false;
  clearRouteHighlights();
  clearSelection();
  packet.classList.remove('active','delivered','returning');
  setPacketAt(origin);

  originLabel.textContent=nodeName(origin);
  destinationLabel.textContent=nodeName(destination);
  document.querySelector(`.device-card[data-device="${destination}"]`)?.classList.add('active');
  getNode(origin)?.classList.add('hop-done');
  getNode(destination)?.classList.add('selected');

  const route=shortestRoute(origin,destination);
  hopLabel.textContent=route.length>1?`${route.length-1} saltos`:'0 saltos';
  simLatency.textContent='—';
  simJitter.textContent='—';

  if(origin===destination){
    simState.textContent='Origen y destino no pueden ser iguales';
    packetStatus.textContent='Ruta inválida';
    sendBtn.disabled=true;
  }else{
    simState.textContent='Ruta lista';
    packetStatus.textContent='Preparado';
    sendBtn.disabled=false;
  }
}

originSelect?.addEventListener('change',()=>{
  origin=originSelect.value;
  if(origin===destination){
    const options=[...destinationSelect.options].map(o=>o.value);
    destination=options.find(value=>value!==origin) || 'srv';
    destinationSelect.value=destination;
  }
  updateRouteUI();
});

destinationSelect?.addEventListener('change',()=>{
  destination=destinationSelect.value;
  if(destination===origin){
    const options=[...originSelect.options].map(o=>o.value);
    origin=options.find(value=>value!==destination) || 'pc1';
    originSelect.value=origin;
  }
  updateRouteUI();
});

cards.forEach(card=>card.addEventListener('click',()=>{
  if(running) return;
  const id=card.dataset.device;
  if(id===origin){
    simState.textContent='Ese equipo ya es el origen';
    packetStatus.textContent='Elige otro destino';
    return;
  }
  destination=id;
  if(destinationSelect) destinationSelect.value=id;
  updateRouteUI();
}));

nodes.forEach(node=>node.addEventListener('click',()=>{
  if(running || ['r1','sw1'].includes(node.id)) return;
  if(node.id===origin){
    simState.textContent='Ese equipo ya es el origen';
    packetStatus.textContent='Elige otro destino';
    return;
  }
  destination=node.id;
  if(destinationSelect) destinationSelect.value=node.id;
  updateRouteUI();
}));

protocol.addEventListener('change',()=>{
  packetProtocol.textContent=protocol.options[protocol.selectedIndex].textContent;
  simLatency.textContent='—';
  simJitter.textContent='—';
  if(!running) packetStatus.textContent='Protocolo actualizado';
});

function movePacket(id,duration,token){
  return new Promise((resolve,reject)=>{
    if(token!==generation) return reject(new Error('simulation-cancelled'));
    const p=positions[id];
    packet.style.transition=`left ${duration}ms cubic-bezier(.22,.9,.28,1), top ${duration}ms cubic-bezier(.22,.9,.28,1)`;
    requestAnimationFrame(()=>{
      if(token===generation){packet.style.left=p.x+'%';packet.style.top=p.y+'%';}
    });
    setTimeout(()=>token===generation?resolve():reject(new Error('simulation-cancelled')),duration+25);
  });
}

async function travelRoute(route, token, phase, startNumber){
  const isReturn = phase === 'Respuesta';
  let eventNumber = startNumber;

  for(let i=1;i<route.length;i++){
    const from=route[i-1], to=route[i];
    const line=getLink(from,to), node=getNode(to);

    line?.classList.add('route-active');
    if(isReturn) line?.classList.add('route-return');
    node?.classList.add(isReturn ? 'hop-return' : 'hop-active');

    simState.textContent=`${phase}: ${nodeName(from)} → ${nodeName(to)}`;
    packetStatus.textContent=isReturn ? `Respuesta ← ${nodeName(to)}` : `Enviando → ${nodeName(to)}`;
    hopLabel.textContent=`${i} / ${route.length-1}`;

    await movePacket(to,390,token);

    line?.classList.remove('route-active');
    line?.classList.add('route-done');
    node?.classList.remove('hop-active','hop-return');
    node?.classList.add('hop-done');

    const isLast=i===route.length-1;
    addEvent(
      eventNumber++,
      phase,
      isLast
        ? `${nodeName(to)} recibió ${isReturn ? 'la respuesta' : 'el mensaje'}.`
        : `Pasó por ${nodeName(to)} y sigue su camino.`,
      isLast ? 'success' : 'normal'
    );
    await wait(80,token);
  }

  return eventNumber;
}

async function sendPacket(){
  if(running || origin===destination) return;
  const route=shortestRoute(origin,destination);
  if(route.length<2){simState.textContent='No se encontró una ruta válida';return;}

  const metrics=simulatedMetrics(route);
  const token=++generation;
  running=true;
  clearRouteHighlights();
  eventList.innerHTML='';
  sendBtn.disabled=true;
  sendBtn.textContent='Transmitiendo…';
  simState.textContent='Preparando mensaje';
  packetProtocol.textContent=protocol.options[protocol.selectedIndex].textContent;
  packetStatus.textContent='Ida →';
  hopLabel.textContent=`0 / ${route.length-1}`;
  simLatency.textContent=`${metrics.latency} ms`;
  simJitter.textContent=`±${metrics.jitter} ms`;
  setPacketAt(origin);
  packet.classList.remove('returning','delivered');
  packet.classList.add('active');
  getNode(origin)?.classList.add('hop-done');
  addEvent(1,'Salida',`${nodeName(origin)} envía un mensaje usando ${protocol.value}. ${metrics.profile.note}`,'info');

  try{
    await wait(180,token);
    let nextEvent = await travelRoute(route,token,'Enviando',2);

    if(token!==generation)return;
    simState.textContent='Destino recibido. Preparando respuesta';
    packetStatus.textContent='Respuesta ←';
    packet.classList.add('returning');
    addEvent(nextEvent++,'Respuesta',`${nodeName(destination)} responde y el paquete vuelve por la misma ruta.`,'info');
    await wait(260,token);

    const returnRoute=[...route].reverse();
    hopLabel.textContent=`0 / ${returnRoute.length-1}`;
    await travelRoute(returnRoute,token,'Respuesta',nextEvent);

    if(token!==generation)return;
    packet.classList.remove('returning');
    packet.classList.add('delivered');
    simState.textContent='Ida y vuelta completadas';
    packetStatus.textContent='Respuesta recibida ✓';
    sendBtn.textContent='Enviar nuevamente';
    sendBtn.disabled=false;
    running=false;
  }catch(error){
    if(error.message!=='simulation-cancelled') console.error(error);
  }
}

function resetSimulation(){
  generation+=1;
  running=false;
  origin='pc1';
  destination='srv';
  if(originSelect) originSelect.value=origin;
  if(destinationSelect) destinationSelect.value=destination;
  eventList.innerHTML='<div class="event neutral"><span>00</span><p><strong>Sistema</strong><small>Esperando una transmisión…</small></p></div>';
  sendBtn.textContent='Enviar paquete';
  packetProtocol.textContent=protocol.options[protocol.selectedIndex].textContent;
  updateRouteUI();
}

sendBtn.addEventListener('click',sendPacket);
resetBtn.addEventListener('click',resetSimulation);
resetSimulation();
