(() => {
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const success = document.getElementById('step-success');
  const form1 = document.getElementById('form-step-1');
  const form2 = document.getElementById('form-step-2');
  const alertBox = document.getElementById('alert-box');
  const fileInput = document.getElementById('file');
  const dropZone = document.getElementById('drop-zone');
  const selectedFile = document.getElementById('selected-file');
  let userEmail = '';

  if (!form1 || !form2) return;

  function setStep(number) {
    [step1, step2, success].forEach((step, index) => {
      const active = index + 1 === number;
      step.hidden = !active;
      step.classList.toggle('active', active);
    });
    document.querySelectorAll('[data-step-dot]').forEach((dot) => {
      const n = Number(dot.dataset.stepDot);
      dot.classList.toggle('active', n <= number);
      dot.classList.toggle('done', n < number);
    });
  }

  function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.dataset.type = type;
    alertBox.hidden = false;
  }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  function setLoading(step, loading) {
    const button = document.getElementById(`btn-step-${step}`);
    const spinner = document.getElementById(`loader-step-${step}`);
    if (!button || !spinner) return;
    button.disabled = loading;
    spinner.hidden = !loading;
  }

  function humanSize(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function updateFile(file) {
    if (!file) { selectedFile.hidden = true; return; }
    document.getElementById('selected-file-name').textContent = file.name;
    document.getElementById('selected-file-size').textContent = humanSize(file.size);
    selectedFile.hidden = false;
  }

  fileInput.addEventListener('change', () => updateFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((eventName) => dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  }));
  dropZone?.addEventListener('drop', (event) => {
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    fileInput.files = transfer.files;
    updateFile(files[0]);
  });

  form1.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    userEmail = document.getElementById('email').value.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+\-]+@(sansano\.usm\.cl|usm\.cl)$/.test(userEmail)) {
      showAlert('El correo debe terminar en @usm.cl o @sansano.usm.cl.');
      return;
    }
    setLoading(1, true);
    try {
      const response = await fetch('/buzon/api/request-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'No pudimos enviar el código. Inténtalo nuevamente.');
      document.getElementById('display-email').textContent = userEmail;
      setStep(2);
      document.getElementById('pin').focus();
    } catch (error) { showAlert(error.message); }
    finally { setLoading(1, false); }
  });

  document.getElementById('btn-back')?.addEventListener('click', () => { hideAlert(); setStep(1); });

  form2.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();
    const pin = document.getElementById('pin').value.trim();
    const file = fileInput.files[0];
    if (!/^\d{6}$/.test(pin)) { showAlert('Escribe el código de 6 dígitos que llegó a tu correo.'); return; }
    if (!file) { showAlert('Selecciona un archivo antes de continuar.'); return; }
    if (file.size > 2e9) { showAlert('El archivo supera el máximo de 2 GB.'); return; }

    setLoading(2, true);
    try {
      const body = new FormData();
      body.append('email', userEmail); body.append('pin', pin); body.append('file', file);
      const response = await fetch('/buzon/api/upload', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'No pudimos recibir el archivo. Revisa el PIN e inténtalo nuevamente.');
      setStep(3);
    } catch (error) { showAlert(error.message); }
    finally { setLoading(2, false); }
  });

  document.getElementById('btn-restart')?.addEventListener('click', () => {
    form1.reset(); form2.reset(); userEmail = ''; selectedFile.hidden = true; hideAlert(); setStep(1);
  });
})();
