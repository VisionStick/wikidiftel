(() => {
  'use strict';
  const config = window.WIKIDIFTEL_SUPABASE;
  const client = window.supabase.createClient(config.url, config.key);
  const $ = (selector) => document.querySelector(selector);
  const state = { courses: [], reviews: [], reports: [], audit: [], semester: null, course: null,
    selected: null, open: new Set(), mode: 'login', tab: 'comments', busy: false };
  let sessionEpoch = 0;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const norm = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const statuses = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
    open: 'Sin revisar', resolved: 'Revisado', dismissed: 'Descartado' };
  const reasons = { offensive: 'Insultos o acoso', spam: 'Spam o publicidad', personal_data: 'Datos personales', other: 'Otro motivo' };
  const actions = { approve_course_review: 'Aprobó el comentario', reject_course_review: 'Rechazó el comentario',
    resolve_course_review_report: 'Revisó un reporte', delete_course_review: 'Eliminó el comentario' };
  function fmt(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
  }
  const badge = (status) => `<span class="badge ${esc(status)}">${esc(statuses[status] || status)}</span>`;

  function notice(message = '', error = false) {
    const element = $('#adminNotice');
    element.textContent = message; element.hidden = !message; element.classList.toggle('error', error);
  }
  function loginScreen(message = '') {
    sessionEpoch += 1; state.mode = 'login';
    state.courses = []; state.reviews = []; state.reports = []; state.audit = [];
    state.semester = null; state.course = null; state.selected = null; state.busy = false; state.open.clear();
    document.documentElement.classList.add('admin-locked');
    $('#adminView').hidden = true; $('#loginView').hidden = false;
    $('#loginError').hidden = !message; $('#loginError').textContent = message; $('#password').value = '';
    for (const id of ['tree', 'rows', 'detail', 'identity', 'pendingCount', 'reportCount']) $('#' + id).replaceChildren();
    notice();
  }
  function adminScreen() {
    state.mode = 'admin'; document.documentElement.classList.remove('admin-locked');
    $('#adminView').hidden = false; $('#loginView').hidden = true;
  }
  async function load() {
    const epoch = sessionEpoch;
    const { data, error } = await client.rpc('admin_console_snapshot');
    if (epoch !== sessionEpoch) return false;
    if (error) throw error;
    if (!Array.isArray(data?.reports) || !Array.isArray(data?.audit)) throw new Error('Falta instalar la migración de moderación en Supabase.');
    state.courses = data.courses || []; state.reviews = data.reviews || [];
    state.reports = data.reports; state.audit = data.audit;
    $('#identity').textContent = data.admin?.display_name || 'Administrador';
    $('#sync').textContent = 'Actualizado ' + fmt(data.generated_at);
    $('#pendingCount').textContent = '(' + state.reviews.filter((r) => r.status === 'pending').length + ' pendientes)';
    $('#reportCount').textContent = '(' + state.reports.filter((r) => r.status === 'open').length + ' sin revisar)';
    filters(); tree(); rows();
    if (state.selected) {
      const { kind, id } = state.selected;
      const item = (kind === 'comments' ? state.reviews : state.reports).find((x) => String(kind === 'comments' ? x.review_id : x.report_id) === String(id));
      if (item) detail(kind, item);
      else { state.selected = null; $('#detail').innerHTML = '<p>Selecciona un elemento para ver su ficha.</p>'; }
    } else $('#detail').innerHTML = '<p>Selecciona un comentario o reporte para revisar su ficha.</p>';
    return true;
  }
  function filters() {
    const professor = $('#professor').value, year = $('#year').value;
    const professors = [...new Set(state.reviews.map((r) => r.professor_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const years = [...new Set(state.reviews.map((r) => r.term_year).filter(Boolean))].sort((a, b) => b - a);
    $('#professor').innerHTML = '<option value="">Todos los profesores</option>' + professors.map((p) => `<option>${esc(p)}</option>`).join('');
    $('#year').innerHTML = '<option value="">Todos los años</option>' + years.map((y) => `<option>${esc(y)}</option>`).join('');
    $('#professor').value = professor; $('#year').value = year;
  }
  function path() {
    $('#pathLabel').textContent = 'Wiki DIFTEL / ' + (state.tab === 'reports' ? 'Reportes' : 'Comentarios')
      + (state.semester ? ' / Semestre ' + state.semester : '') + (state.course ? ' / ' + state.course.code : '');
  }
  function choose(semester = null, course = null) {
    if (state.busy) return;
    state.semester = semester; state.course = course; state.selected = null;
    $('#detail').innerHTML = '<p>Selecciona un elemento para ver su ficha.</p>'; path(); tree(); rows();
  }
  function setTab(tab) {
    if (state.busy || !['comments', 'reports'].includes(tab)) return;
    state.tab = tab; state.selected = null;
    $('#status').hidden = tab !== 'comments'; $('#reportStatus').hidden = tab !== 'reports';
    document.querySelectorAll('[data-admin-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.adminTab === tab)));
    $('#detail').innerHTML = '<p>Selecciona un elemento para ver su ficha.</p>'; notice(); path(); tree(); rows();
  }
  function tree() {
    const semesters = [...new Set(state.courses.map((c) => c.semester_number))].sort((a, b) => a - b);
    $('#tree').innerHTML = `<div class="tree-row ${!state.semester && !state.course ? 'active' : ''}" data-all><span class="twisty"></span>🗂️ <b>Todos los ${state.tab === 'reports' ? 'reportes' : 'comentarios'}</b></div>`
      + semesters.map((s) => `<div class="tree-node"><div class="tree-row ${state.semester === s && !state.course ? 'active' : ''}" data-sem="${s}"><span class="twisty">${state.open.has(s) ? '▾' : '▸'}</span>📁 Semestre ${s}</div><div class="children ${state.open.has(s) ? '' : 'closed'}">`
        + state.courses.filter((c) => c.semester_number === s).map((c) => `<div class="tree-row ${state.course?.id === c.id ? 'active' : ''}" data-course="${c.id}"><span class="twisty"></span>📄 ${esc(c.name)} <span class="course-code">(${esc(c.code)})</span></div>`).join('') + '</div></div>').join('');
    $('#tree [data-all]').onclick = () => choose();
    document.querySelectorAll('[data-sem]').forEach((el) => { el.onclick = () => {
      if (state.busy) return;
      const s = Number(el.dataset.sem); state.open.has(s) ? state.open.delete(s) : state.open.add(s); choose(s);
    }; });
    document.querySelectorAll('[data-course]').forEach((el) => { el.onclick = () => {
      if (state.busy) return;
      const course = state.courses.find((c) => c.id === Number(el.dataset.course));
      state.open.add(course.semester_number); choose(course.semester_number, course);
    }; });
  }
  function visible() {
    const q = norm($('#search').value), professor = $('#professor').value, year = $('#year').value;
    const status = $(state.tab === 'reports' ? '#reportStatus' : '#status').value;
    return (state.tab === 'reports' ? state.reports : state.reviews).filter((r) =>
      (!state.semester || r.semester_number === state.semester) && (!state.course || r.course_id === state.course.id)
      && (!professor || r.professor_name === professor) && (!year || String(r.term_year) === year)
      && (!status || r.status === status)
      && (!q || norm([r.student_name, r.professor_name, r.course_code, r.course_name, r.comment, r.detail, reasons[r.reason]].join(' ')).includes(q)));
  }
  function rows() {
    const reports = state.tab === 'reports', list = visible();
    const headers = reports ? ['Reporte', 'Motivo', 'Ramo', 'Nombre / alias', 'Fecha y hora', 'Comentario', 'Reporte']
      : ['Nombre / alias', 'Profesor/a', 'Ramo', 'Año', 'Valoraciones', '👍 / 👎', 'Reportes abiertos', 'Fecha y hora', 'Estado'];
    $('#tableHead').innerHTML = '<tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';
    $('#count').textContent = list.length + (reports ? ' reporte' : ' comentario') + (list.length === 1 ? '' : 's');
    $('#rows').innerHTML = list.length ? list.map((r) => {
      const id = reports ? r.report_id : r.review_id;
      const selected = state.selected?.kind === state.tab && String(state.selected.id) === String(id);
      const cells = reports
        ? [esc('#' + r.report_id), esc(reasons[r.reason] || r.reason), esc(r.course_code), esc(r.student_name || 'Anónimo'), fmt(r.created_at), badge(r.review_status), badge(r.status)]
        : [esc(r.student_name || 'Anónimo'), esc(r.professor_name || '—'), esc(r.course_code), esc(r.term_year || '—') + (r.term_semester ? ' · ' + esc(r.term_semester) : ''), `D ${esc(r.difficulty)} · C ${esc(r.workload)} · U ${esc(r.usefulness)}`, `👍 ${esc(r.likes_count)} / 👎 ${esc(r.dislikes_count)}`, esc(r.open_reports || 0), fmt(r.created_at), badge(r.status)];
      return `<tr data-item-id="${esc(id)}" class="${selected ? 'selected' : ''}">` + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>';
    }).join('') : `<tr><td colspan="${headers.length}" class="empty">No hay ${reports ? 'reportes' : 'comentarios'} con estos filtros.</td></tr>`;
    document.querySelectorAll('[data-item-id]').forEach((tr) => { tr.onclick = () => {
      if (state.busy) return;
      const item = list.find((r) => String(reports ? r.report_id : r.review_id) === tr.dataset.itemId); detail(state.tab, item);
    }; });
  }
  function auditHTML(reviewId) {
    const entries = state.audit.filter((a) => String(a.review_id) === String(reviewId));
    return '<section class="audit-list"><h3>Acciones recientes de moderación</h3>' + (entries.length
      ? '<ul>' + entries.map((a) => `<li><strong>${esc(a.admin_name)}</strong> · ${esc(actions[a.action] || a.action)} · ${fmt(a.created_at)}${a.payload?.report_id ? ' · Reporte #' + esc(a.payload.report_id) : ''}${a.payload?.new_status ? ' · ' + esc(statuses[a.payload.new_status] || a.payload.new_status) : ''}${a.payload?.note ? '<br>' + esc(a.payload.note) : ''}</li>`).join('') + '</ul>'
      : '<p>No hay acciones para este comentario entre los últimos 100 registros.</p>') + '</section>';
  }
  function actionButton(id, label, unavailable = false, danger = false) {
    return `<button id="${id}" class="${danger ? 'danger' : ''}" data-unavailable="${unavailable}" ${unavailable || state.busy ? 'disabled' : ''}>${label}</button>`;
  }
  function field(label, value) { return `<div class="field"><b>${label}</b>${esc(value ?? '—')}</div>`; }
  function detail(kind, item) {
    if (!item) return;
    state.selected = { kind, id: kind === 'comments' ? item.review_id : item.report_id }; rows();
    if (kind === 'comments') {
      $('#detail').innerHTML = `<h2>Comentario #${esc(item.review_id)} · ${esc(item.course_code)} — ${esc(item.course_name)}</h2><div class="detail-grid">`
        + field('Nombre / alias', item.student_name || 'Anónimo') + field('Profesor/a', item.professor_name)
        + field('Período cursado', (item.term_year || '—') + ' / ' + (item.term_semester || '—')) + field('Recibido', fmt(item.created_at))
        + field('Dificultad / Carga / Utilidad', [item.difficulty, item.workload, item.usefulness].join(' / '))
        + field('Horas de estudio', item.study_hours) + field('Estado', statuses[item.status]) + field('Reportes abiertos', item.open_reports || 0)
        + `<div class="comment-box">${esc(item.comment)}</div><label class="moderation-note">Motivo o nota de moderación (obligatorio al rechazar)<textarea id="moderationNote" maxlength="500"></textarea></label><div class="detail-actions">`
        + actionButton('approveReview', 'Aprobar comentario', item.status === 'approved')
        + actionButton('rejectReview', 'Rechazar / ocultar', item.status === 'rejected')
        + actionButton('deleteReview', 'Eliminar definitivamente', false, true) + '</div>' + auditHTML(item.review_id) + '</div>';
      $('#approveReview').onclick = () => moderate(item, 'approved');
      $('#rejectReview').onclick = () => moderate(item, 'rejected'); $('#deleteReview').onclick = () => removeReview(item);
    } else {
      $('#detail').innerHTML = `<h2>Reporte #${esc(item.report_id)} · Comentario #${esc(item.review_id)} · ${esc(item.course_code)}</h2><div class="detail-grid">`
        + field('Motivo', reasons[item.reason]) + field('Recibido', fmt(item.created_at))
        + field('Estado del reporte', statuses[item.status]) + field('Estado del comentario', statuses[item.review_status])
        + `<div class="comment-box"><strong>Comentario reportado</strong><br>${esc(item.comment)}</div><div class="comment-box"><strong>Detalle del reporte</strong><br>${esc(item.detail || 'Sin detalle adicional.')}</div>`
        + (item.resolved_at ? `<p class="detail-message">Revisado por ${esc(item.resolved_by_name)} · ${fmt(item.resolved_at)}<br>${esc(item.resolution_note)}</p>` : '')
        + '<p class="detail-message">Cerrar o descartar el reporte no cambia la visibilidad del comentario. Para ocultarlo, revisa el comentario y recházalo.</p>'
        + '<label class="moderation-note">Motivo de la decisión<textarea id="moderationNote" maxlength="500"></textarea></label><div class="detail-actions">'
        + actionButton('viewReportedReview', 'Revisar comentario') + actionButton('resolveReport', 'Cerrar reporte', item.status !== 'open')
        + actionButton('dismissReport', 'Descartar reporte', item.status !== 'open') + '</div>' + auditHTML(item.review_id) + '</div>';
      $('#viewReportedReview').onclick = () => {
        const review = state.reviews.find((r) => r.review_id === item.review_id);
        setTab('comments'); $('#status').value = ''; if (review) detail('comments', review);
      };
      $('#resolveReport').onclick = () => resolveReport(item, 'resolved'); $('#dismissReport').onclick = () => resolveReport(item, 'dismissed');
    }
  }
  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('#detail button').forEach((b) => { b.disabled = busy || b.dataset.unavailable === 'true'; });
  }
  async function runAction(functionName, args, message) {
    if (state.busy) return;
    const epoch = sessionEpoch;
    let saved = false;
    setBusy(true); notice();
    try {
      const { data, error } = await client.rpc(functionName, args);
      if (epoch !== sessionEpoch) return;
      if (error || !data?.ok) throw error || new Error('La acción no fue confirmada.');
      saved = true; await load();
      if (epoch === sessionEpoch) notice(message);
    } catch (error) {
      if (epoch === sessionEpoch) notice(saved ? 'La acción se guardó, pero no pudimos actualizar la lista. Pulsa Actualizar.'
        : 'No se pudo guardar la acción: ' + (error?.message || 'Intenta nuevamente.'), true);
    } finally { if (epoch === sessionEpoch) setBusy(false); }
  }
  function moderate(review, target) {
    const note = $('#moderationNote').value.trim();
    if (target === 'rejected' && !note) { notice('Indica el motivo del rechazo.', true); $('#moderationNote').focus(); return; }
    runAction('admin_moderate_course_review', { review_id_input: review.review_id,
      target_status_input: target, expected_status_input: review.status, note_input: note || null },
    target === 'approved' ? 'Comentario aprobado. Ya puede aparecer en la página pública.' : 'Comentario rechazado y oculto. Sus reportes abiertos quedaron revisados.');
  }
  function resolveReport(report, target) {
    const note = $('#moderationNote').value.trim();
    if (!note) { notice('Indica el motivo de la decisión.', true); $('#moderationNote').focus(); return; }
    runAction('admin_resolve_course_review_report', { report_id_input: report.report_id, target_status_input: target, note_input: note },
      target === 'resolved' ? 'Reporte revisado y cerrado.' : 'Reporte descartado. La decisión quedó registrada.');
  }
  function removeReview(review) {
    if (!confirm(`¿Eliminar definitivamente el comentario #${review.review_id} de ${review.course_code}?\n\nEl comentario y sus reportes se conservarán en la auditoría administrativa.`)) return;
    runAction('admin_delete_course_review', { review_id_input: review.review_id }, 'Comentario eliminado. La acción quedó registrada en auditoría.');
  }
  $('#loginForm').onsubmit = async (event) => {
    event.preventDefault(); $('#loginError').hidden = true; $('#loginForm').classList.add('busy');
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) { loginScreen('Correo, contraseña o acceso incorrectos.'); return; }
      if (await load()) { adminScreen(); $('#password').value = ''; }
    } catch (error) {
      await client.auth.signOut({ scope: 'local' });
      loginScreen(error?.message?.includes('migración') ? error.message : 'La cuenta no tiene acceso administrativo o no se pudo validar la sesión.');
    } finally { $('#loginForm').classList.remove('busy'); }
  };
  $('#logout').onclick = async () => { loginScreen(); try { await client.auth.signOut({ scope: 'local' }); } finally { location.replace(location.pathname); } };
  $('#refresh').onclick = () => { if (!state.busy) load().then((ok) => { if (ok) notice('Lista actualizada.'); }).catch(() => loginScreen('No se pudo validar la sesión.')); };
  $('#expand').onclick = () => { state.courses.forEach((c) => state.open.add(c.semester_number)); tree(); };
  $('#collapse').onclick = () => { state.open.clear(); tree(); };
  for (const id of ['search', 'professor', 'year', 'status', 'reportStatus']) $('#' + id).addEventListener(id === 'search' ? 'input' : 'change', rows);
  $('#clear').onclick = () => { for (const id of ['search', 'professor', 'year', 'status', 'reportStatus']) $('#' + id).value = ''; rows(); };
  document.querySelectorAll('[data-admin-tab]').forEach((button) => { button.onclick = () => setTab(button.dataset.adminTab); });
  client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) loginScreen(); });
  (async () => {
    loginScreen(); const { data, error } = await client.auth.getSession();
    if (error || !data.session) return;
    try { if (await load()) adminScreen(); }
    catch { await client.auth.signOut({ scope: 'local' }); loginScreen('La sesión guardada no tiene acceso administrativo o falta actualizar la moderación.'); }
  })();
})();
