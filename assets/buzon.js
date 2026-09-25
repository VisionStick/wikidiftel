// DIFTEL SJ
// La subida de archivos desde la página fue desactivada.
// La participación estudiantil se realiza mediante opiniones en cada ficha de ramo.
// Las bibliotecas de material se administran como enlaces externos por código de ramo.
(() => {
  const legacyForms = document.querySelectorAll('#form-step-1, #form-step-2, #drop-zone, input[type="file"]');
  legacyForms.forEach((el) => {
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
  });
})();
