const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const ADMIN = 'd7c1c339-f041-4b2f-b0d9-d0591458b412';
const OTHER = '00000000-0000-4000-8000-000000000002';
const COMMENT = 'El ramo requiere práctica semanal y organizar bien los ejercicios.';

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${ADMIN}'), ('${OTHER}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;`);
  await db.exec(read('supabase/schema.sql'));
  await db.exec(read('supabase/course-reviews.sql'));
  await db.exec(read('supabase/admin-console.sql'));
  const course = (await db.query(`insert into public.courses
    (semester_id,area_id,code,slug,name,sct) values
    ((select id from public.semesters limit 1),(select id from public.academic_areas limit 1),
    'TEST070','test070','Ramo de prueba',6) returning id`)).rows[0].id;
  async function call(role, uid, sql, values = []) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
    if (role) await db.exec('set role ' + role);
    try { return await db.query(sql, values); }
    finally { await db.exec('reset role'); }
  }
  const submit = (difficulty = 3) => call('anon', '',
    'select * from public.submit_course_review($1,null,null,2026,\'1\',$2,3,3,6,$3)', [course, difficulty, COMMENT]);
  const moderate = (id, target, expected, note = null, uid = ADMIN) => call('authenticated', uid,
    'select public.admin_moderate_course_review($1,$2,$3,$4) as result', [id, target, expected, note]);
  const report = (id, token = 'test-browser-token-0001', reason = 'spam') => call('anon', '',
    'select public.report_course_review($1,$2,$3,null) as result', [id, token, reason]);
  return { db, course, call, submit, moderate, report };
}

test('PostgreSQL: permisos, estados y auditoría de moderación', async (t) => {
  const { db, course, call, submit, moderate, report } = await database();
  let id, reportId;
  try {
    await t.test('un envío anónimo queda pendiente y no es visible por tabla ni vista', async () => {
      id = (await submit()).rows[0].id;
      assert.equal((await db.query('select status from course_reviews where id=$1', [id])).rows[0].status, 'pending');
      for (const table of ['course_reviews', 'course_review_public_view']) {
        assert.equal((await call('anon', '', `select * from public.${table} where id=$1`, [id])).rows.length, 0);
      }
      await assert.rejects(submit(null), /valoraciones/);
      await assert.rejects(report(id), /no disponible/);
    });
    await t.test('anon y authenticated no pueden insertar, aprobar, borrar ni leer reportes directamente', async () => {
      for (const role of ['anon', 'authenticated']) {
        await assert.rejects(call(role, OTHER, "insert into course_reviews(course_id,comment,status) values($1,$2,'approved')", [course, COMMENT]), /permission denied/);
        await assert.rejects(call(role, OTHER, "update course_reviews set status='approved' where id=$1", [id]), /permission denied/);
        await assert.rejects(call(role, OTHER, 'delete from course_reviews where id=$1', [id]), /permission denied/);
        for (const table of ['course_review_reports', 'admin_users', 'admin_audit_log']) {
          await assert.rejects(call(role, OTHER, `select * from ${table}`), /permission denied/);
        }
      }
      await assert.rejects(call('anon', '', 'select admin_console_snapshot()'), /permission denied/);
    });
    await t.test('una cuenta sin permiso o desactivada no puede usar RPC administrativas', async () => {
      await assert.rejects(call('authenticated', OTHER, 'select admin_console_snapshot()'), /no autorizado/);
      await assert.rejects(moderate(id, 'approved', 'pending', null, OTHER), /no autorizado/);
      await assert.rejects(call('authenticated', OTHER, 'select admin_delete_course_review($1)', [id]), /no autorizado/);
      await db.query('update admin_users set is_active=false where user_id=$1', [ADMIN]);
      await assert.rejects(moderate(id, 'approved', 'pending'), /no autorizado/);
      await db.exec(read('supabase/admin-console.sql'));
      assert.equal((await db.query('select is_active from admin_users where user_id=$1', [ADMIN])).rows[0].is_active, false);
      await db.query('update admin_users set is_active=true where user_id=$1', [ADMIN]);
    });
    await t.test('aprobar publica y registra administrador, hora y estados; una decisión desactualizada falla', async () => {
      await moderate(id, 'approved', 'pending', 'Experiencia útil para el ramo');
      assert.equal((await call('anon', '', 'select * from course_review_public_view where id=$1', [id])).rows.length, 1);
      await assert.rejects(moderate(id, 'rejected', 'pending', 'Cambio desactualizado'), /comentario cambió/);
      const row = (await db.query('select * from admin_audit_log where review_id=$1', [id])).rows[0];
      assert.equal(row.admin_user_id, ADMIN); assert.ok(row.created_at);
      assert.equal(row.action, 'approve_course_review'); assert.equal(row.payload.previous_status, 'pending');
      assert.equal(row.payload.new_status, 'approved');
    });
    await t.test('un reporte no oculta; se valida, se deduplica y no expone tokens al panel', async () => {
      await report(id); await report(id);
      await assert.rejects(report(id, 'short'), /Token inválido/);
      await assert.rejects(report(id, 'test-browser-token-0002', 'invalid'), /Motivo/);
      const reports = (await db.query('select * from course_review_reports where review_id=$1', [id])).rows;
      assert.equal(reports.length, 1); reportId = reports[0].id;
      assert.equal((await db.query('select status from course_reviews where id=$1', [id])).rows[0].status, 'approved');
      const snapshot = (await call('authenticated', ADMIN, 'select admin_console_snapshot() as data')).rows[0].data;
      assert.equal(snapshot.reports.length, 1); assert.equal(snapshot.reviews[0].open_reports, 1);
      assert.equal(Object.hasOwn(snapshot.reports[0], 'client_token'), false);
      await assert.rejects(call('authenticated', OTHER, 'select admin_resolve_course_review_report($1,\'dismissed\',\'Sin permiso\')', [reportId]), /no autorizado/);
    });
    await t.test('rechazar exige motivo, oculta y cierra reportes con identidad y motivo', async () => {
      await assert.rejects(moderate(id, 'rejected', 'approved'), /motivo del rechazo/);
      await moderate(id, 'rejected', 'approved', 'Publicidad ajena al ramo');
      assert.equal((await call('anon', '', 'select * from course_review_public_view where id=$1', [id])).rows.length, 0);
      const row = (await db.query('select * from course_review_reports where id=$1', [reportId])).rows[0];
      assert.equal(row.status, 'resolved'); assert.equal(row.resolved_by, ADMIN);
      assert.equal(row.resolution_note, 'Publicidad ajena al ramo'); assert.ok(row.resolved_at);
      const audit = (await db.query("select * from admin_audit_log where action='reject_course_review' and review_id=$1", [id])).rows[0];
      assert.deepEqual(audit.payload.resolved_report_ids, [reportId]);
    });
    await t.test('descartar un reporte registra la decisión y mantiene el comentario aprobado', async () => {
      await moderate(id, 'approved', 'rejected', 'Decisión corregida');
      await report(id, 'test-browser-token-0002');
      reportId = (await db.query("select id from course_review_reports where review_id=$1 and status='open'", [id])).rows[0].id;
      await assert.rejects(call('authenticated', ADMIN, 'select admin_resolve_course_review_report($1,\'dismissed\',null)', [reportId]), /motivo/);
      await call('authenticated', ADMIN, 'select admin_resolve_course_review_report($1,\'dismissed\',\'El comentario no contiene publicidad\')', [reportId]);
      await assert.rejects(call('authenticated', ADMIN, 'select admin_resolve_course_review_report($1,\'resolved\',\'Ya revisado\')', [reportId]), /ya fue revisado/);
      assert.equal((await db.query('select status from course_reviews where id=$1', [id])).rows[0].status, 'approved');
      const audit = (await db.query("select * from admin_audit_log where action='resolve_course_review_report'")).rows[0];
      assert.equal(audit.admin_user_id, ADMIN); assert.equal(audit.payload.new_status, 'dismissed');
    });
    await t.test('si falla la auditoría se revierte la decisión completa', async () => {
      await db.exec("create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_audit before insert on admin_audit_log for each row execute function fail_audit();");
      await assert.rejects(moderate(id, 'rejected', 'approved', 'Prueba de atomicidad'), /audit unavailable/);
      assert.equal((await db.query('select status from course_reviews where id=$1', [id])).rows[0].status, 'approved');
      await db.exec('drop trigger fail_audit on admin_audit_log; drop function fail_audit();');
    });
    await t.test('el borrado auditado conserva comentario y reportes, sin tokens', async () => {
      await call('authenticated', ADMIN, 'select admin_delete_course_review($1)', [id]);
      assert.equal((await db.query('select * from course_reviews where id=$1', [id])).rows.length, 0);
      assert.equal((await db.query('select * from course_review_reports where review_id=$1', [id])).rows.length, 0);
      const row = (await db.query("select * from admin_audit_log where review_id=$1 and action='delete_course_review'", [id])).rows[0];
      assert.equal(row.payload.review.comment, COMMENT); assert.equal(row.payload.reports.length, 2);
      assert.equal(JSON.stringify(row.payload).includes('client_token'), false);
    });
  } finally { await db.close(); }
});

test('PostgreSQL: migración sobre instalación anterior, idempotencia y conservación', async () => {
  const { db, course, call, submit } = await database();
  try {
    await db.exec(`drop table course_review_reports cascade;
      grant insert, update, delete on course_reviews to anon, authenticated;
      create policy "Public can submit approved reviews" on course_reviews for insert to anon with check(status='approved');
      alter table course_reviews alter column status set default 'approved';
      create or replace function submit_course_review(course_id_input bigint,student_name_input text,
        professor_name_input text,term_year_input int,term_semester_input text,difficulty_input int,
        workload_input int,usefulness_input int,study_hours_input int,comment_input text)
      returns table(id bigint,course_id bigint,created_at timestamptz) language sql security definer as $$
        insert into public.course_reviews(course_id,comment,status) values($1,$10,'approved')
        returning course_reviews.id,course_reviews.course_id,course_reviews.created_at $$;`);
    const previous = (await db.query("insert into course_reviews(course_id,comment,status) values($1,$2,'approved') returning id", [course, COMMENT])).rows[0].id;
    await db.exec(read('supabase/comment-moderation.sql')); await db.exec(read('supabase/comment-moderation.sql'));
    assert.equal((await db.query('select status from course_reviews where id=$1', [previous])).rows[0].status, 'approved');
    const id = (await submit()).rows[0].id;
    assert.equal((await db.query('select status from course_reviews where id=$1', [id])).rows[0].status, 'pending');
    await assert.rejects(call('anon', '', "update course_reviews set status='approved' where id=$1", [id]), /permission denied/);
    // Re-ejecutar los archivos de instalación tampoco reabre INSERT ni vuelve a autoaprobar.
    await db.exec(read('supabase/schema.sql')); await db.exec(read('supabase/course-reviews.sql')); await db.exec(read('supabase/admin-console.sql'));
    const second = (await submit()).rows[0].id;
    assert.equal((await db.query('select status from course_reviews where id=$1', [second])).rows[0].status, 'pending');
    await assert.rejects(call('anon', '', "insert into course_reviews(course_id,comment) values($1,$2)", [course, COMMENT]), /permission denied/);
  } finally { await db.close(); }
});

const wait = async (predicate) => {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise((r) => setTimeout(r, 5)); }
  assert.fail('El DOM no alcanzó el estado esperado');
};
function dom(html, url) {
  return new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
}
async function publicPage() {
  const page = dom('<!doctype html><html><head></head><body><main><div id="course-v4-root"></div></main></body></html>', 'https://diftel.test/ramo/?c=test070');
  const window = page.window;
  const calls = [];
  const state = { fail: false };
  const course = { id: 1, code: 'TEST070', slug: 'test070', name: 'Ramo de prueba' };
  const review = { id: 10, course_id: 1, course_code: 'TEST070', comment: COMMENT,
    student_name: '<img src=x onerror=alert(1)>', difficulty: 3, workload: 3, usefulness: 3, likes_count: 0, dislikes_count: 0, status: 'approved' };
  window.WIKIDIFTEL_SUPABASE = { url: 'https://mock.supabase.test', key: 'public-test-key' };
  window.fetch = async (url, options) => {
    const parsed = new URL(url), body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path: parsed.pathname, body });
    if (parsed.pathname.endsWith('/submit_course_review')) {
      if (state.fail) return new Response('Temporal failure', { status: 503 });
      return Response.json([{ id: 11, course_id: 1, created_at: new Date().toISOString() }]);
    }
    if (parsed.pathname.endsWith('/report_course_review')) return Response.json({ ok: true });
    if (parsed.pathname.endsWith('/set_course_review_reaction')) return Response.json([{ likes_count: 1, dislikes_count: 0, action: 'added' }]);
    return Response.json(parsed.pathname.endsWith('/course_full_view') ? [course] : [review]);
  };
  window.eval(read('assets/supabase-courses.js')); window.eval(read('assets/course-reviews-stable.js'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await wait(() => window.document.querySelectorAll('.stable-review').length === 1);
  const fill = () => {
    const form = window.document.querySelector('#stable-review-form');
    for (const [name, value] of Object.entries({ comment: COMMENT, student_name: 'Alias', difficulty: '3', workload: '3', usefulness: '3' })) form.elements.namedItem(name).value = value;
    return form;
  };
  return { page, window, calls, state, fill };
}
test('DOM: envío anónimo pendiente, reporte y contenido escapado', async () => {
  const { page, window, calls, fill } = await publicPage();
  try {
    const form = fill(); const url = window.location.href;
    const event = new window.Event('submit', { bubbles: true, cancelable: true }); form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    await wait(() => window.document.body.textContent.includes('Comentario enviado para revisión.'));
    assert.equal(window.location.href, url); assert.equal(window.document.querySelectorAll('.stable-review').length, 1);
    assert.equal(window.document.querySelector('#stable-review-form').elements.comment.value, '');
    assert.equal(calls.filter((c) => c.path.endsWith('/submit_course_review')).length, 1);
    assert.equal(window.document.querySelector('.stable-author img'), null);
    const report = window.document.querySelector('[data-report-form]');
    report.elements.reason.value = 'spam'; report.elements.detail.value = 'Publicidad';
    report.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(() => report.querySelector('[data-report-status]').textContent.includes('Reporte enviado.'));
    assert.equal(calls.find((c) => c.path.endsWith('/report_course_review')).body.review_id_input, 10);
    assert.equal(window.document.querySelectorAll('.stable-review').length, 1);
  } finally { page.window.close(); }
});
test('DOM: conserva el borrador al ordenar y al fallar un envío', async () => {
  const { page, window, state, fill } = await publicPage();
  try {
    fill(); const sort = window.document.querySelector('#stable-review-sort');
    sort.value = 'old'; sort.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(window.document.querySelector('#stable-review-form').elements.comment.value, COMMENT);
    state.fail = true;
    window.document.querySelector('#stable-review-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(() => window.document.body.textContent.includes('Conservamos lo que escribiste'));
    const form = window.document.querySelector('#stable-review-form');
    assert.equal(form.elements.comment.value, COMMENT); assert.equal(form.elements.student_name.value, 'Alias');
    assert.equal(form.querySelector('button').disabled, false);
  } finally { page.window.close(); }
});

async function adminPage(options = {}) {
  const page = dom(read('admin-console/index.html'), 'https://diftel.test/admin-console/');
  const window = page.window, calls = [];
  const snapshot = { admin: { display_name: 'Administrador de prueba' }, generated_at: new Date().toISOString(),
    courses: [{ id: 1, code: 'TEST070', slug: 'test070', name: 'Ramo de prueba', semester_number: 1 }],
    reviews: [{ review_id: 1, course_id: 1, course_code: 'TEST070', course_name: 'Ramo de prueba', semester_number: 1,
      comment: '<img src=x onerror=alert(1)> texto de prueba', status: 'pending', created_at: new Date().toISOString(), open_reports: 1 }],
    reports: [{ report_id: 2, review_id: 1, course_id: 1, course_code: 'TEST070', semester_number: 1,
      comment: COMMENT, detail: 'Publicidad', reason: 'spam', status: 'open', review_status: 'pending', created_at: new Date().toISOString() }], audit: [] };
  let authCallback;
  window.WIKIDIFTEL_SUPABASE = { url: 'https://mock.supabase.test', key: 'public-test-key' };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: ADMIN } } } }),
      onAuthStateChange: (fn) => { authCallback = fn; }, signOut: async () => { authCallback('SIGNED_OUT', null); },
      signInWithPassword: async () => ({ error: null }) },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'admin_console_snapshot') {
        if (options.delay) await options.delay;
        return options.deny ? { error: { message: 'Acceso administrativo no autorizado' } } : { data: structuredClone(snapshot) };
      }
      if (name === 'admin_moderate_course_review') {
        snapshot.reviews[0].status = args.target_status_input;
        snapshot.reports[0].review_status = args.target_status_input;
        if (args.target_status_input === 'rejected') snapshot.reports[0].status = 'resolved';
        snapshot.audit.push({ id: 1, review_id: 1, action: args.target_status_input === 'approved' ? 'approve_course_review' : 'reject_course_review',
          admin_name: 'Administrador de prueba', created_at: new Date().toISOString(), payload: { note: args.note_input, new_status: args.target_status_input } });
      }
      if (name === 'admin_resolve_course_review_report') snapshot.reports[0].status = args.target_status_input;
      return { data: { ok: true } };
    }
  }) };
  window.eval(read('assets/admin-console.js'));
  return { page, window, calls, snapshot, signOut: () => authCallback('SIGNED_OUT', null) };
}
test('DOM: consola aprueba, exige motivo, rechaza y muestra quién actuó', async () => {
  const { page, window, calls } = await adminPage();
  const document = window.document;
  try {
    await wait(() => !document.querySelector('#adminView').hidden);
    assert.equal(document.querySelector('#status').value, 'pending');
    document.querySelector('[data-item-id="1"]').click();
    assert.equal(document.querySelector('#detail img'), null);
    document.querySelector('#approveReview').click();
    await wait(() => document.querySelector('#adminNotice').textContent.includes('Comentario aprobado.'));
    assert.equal(calls.find((c) => c.name === 'admin_moderate_course_review').args.expected_status_input, 'pending');
    assert.match(document.querySelector('.audit-list').textContent, /Administrador de prueba/);
    const count = calls.length; document.querySelector('#rejectReview').click();
    assert.equal(calls.length, count); assert.match(document.querySelector('#adminNotice').textContent, /motivo del rechazo/);
    document.querySelector('#moderationNote').value = 'Publicidad ajena al ramo'; document.querySelector('#rejectReview').click();
    await wait(() => document.querySelector('#adminNotice').textContent.includes('Comentario rechazado'));
    document.querySelector('[data-admin-tab="reports"]').click();
    assert.match(document.querySelector('#rows').textContent, /No hay reportes/);
  } finally { page.window.close(); }
});
test('DOM: revisión de reportes y protección contra respuestas después del cierre de sesión', async () => {
  const first = await adminPage();
  try {
    await wait(() => !first.window.document.querySelector('#adminView').hidden);
    const document = first.window.document;
    document.querySelector('[data-admin-tab="reports"]').click(); document.querySelector('[data-item-id="2"]').click();
    document.querySelector('#moderationNote').value = 'Reporte revisado'; document.querySelector('#dismissReport').click();
    await wait(() => document.querySelector('#adminNotice').textContent.includes('Reporte descartado'));
    assert.equal(first.calls.find((c) => c.name === 'admin_resolve_course_review_report').args.target_status_input, 'dismissed');
  } finally { first.page.window.close(); }
  let release;
  const second = await adminPage({ delay: new Promise((resolve) => { release = resolve; }) });
  try {
    await wait(() => second.calls.length > 0); second.signOut(); release();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(second.window.document.querySelector('#adminView').hidden, true);
    assert.equal(second.window.document.querySelector('#rows').textContent, '');
    assert.equal(second.window.document.querySelector('#detail').textContent, '');
  } finally { second.page.window.close(); }
});

test('DOM: la consola queda bloqueada si el servidor deniega la cuenta', async () => {
  const { page, window, calls } = await adminPage({ deny: true });
  try {
    await wait(() => calls.length > 0 && !window.document.querySelector('#loginError').hidden);
    assert.equal(window.document.querySelector('#adminView').hidden, true);
    assert.equal(window.document.documentElement.classList.contains('admin-locked'), true);
    assert.equal(window.document.querySelector('#rows').textContent, '');
    assert.equal(window.document.querySelector('#detail').textContent, '');
  } finally { page.window.close(); }
});
