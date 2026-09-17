(() => {
  const form = document.getElementById('buzon-form');
  const requestBtn = document.getElementById('request-pin');
  const status = document.getElementById('buzon-status');
  const emailInput = document.getElementById('email');
  const pinInput = document.getElementById('pin');
  const fileInput = document.getElementById('file');
  const setStatus = (message) => { if (status) status.textContent = message; };
  requestBtn?.addEventListener('click', async () => {
    const email = emailInput?.value?.trim();
    if (!email) return setStatus('Escribe tu correo institucional primero.');
    requestBtn.disabled = true;
    setStatus('Solicitando PIN…');
    try {
      const res = await fetch('/buzon/api/request-pin', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const data = await res.json().catch(() => ({}));
      setStatus(data.message || data.detail || (res.ok ? 'PIN enviado.' : 'No se pudo solicitar el PIN.'));
    } catch (err) { setStatus('No se pudo conectar con el servidor.'); }
    requestBtn.disabled = false;
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput?.value?.trim();
    const pin = pinInput?.value?.trim();
    const file = fileInput?.files?.[0];
    if (!email || !pin || !file) return setStatus('Completa correo, PIN y archivo.');
    const payload = new FormData();
    payload.append('email', email); payload.append('pin', pin); payload.append('file', file);
    setStatus('Subiendo archivo…');
    try {
      const res = await fetch('/buzon/api/upload', {method:'POST', body:payload});
      const data = await res.json().catch(() => ({}));
      setStatus(data.detail || (res.ok ? 'Archivo recibido correctamente.' : 'No se pudo subir el archivo.'));
      if (res.ok) form.reset();
    } catch (err) { setStatus('No se pudo conectar con el servidor.'); }
  });
})();
