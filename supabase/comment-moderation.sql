-- WikiDIFTEL · moderación previa y reportes, sin login de estudiantes.
-- ACTUALIZACIÓN DE LA INSTALACIÓN EXISTENTE:
-- Supabase > SQL Editor > New query > pegar este archivo completo > Run.
-- Ejecutar ANTES de desplegar el frontend de este PR.
-- Conserva el estado de los comentarios ya existentes y las cuentas autorizadas.
-- La transacción revierte todo si falta algún requisito o se produce un error.

begin;
do $$
begin
  if to_regclass('public.course_reviews') is null
     or to_regclass('public.course_review_reactions') is null
     or to_regclass('public.admin_users') is null then
    raise exception 'Primero instala schema.sql, course-reviews.sql y admin-console.sql';
  end if;
end;
$$;

-- 3) RLS.
alter table public.course_reviews enable row level security;
alter table public.course_review_reactions enable row level security;

drop policy if exists "Public can read approved reviews" on public.course_reviews;
drop policy if exists "Public can submit pending reviews" on public.course_reviews;
drop policy if exists "Public can submit approved reviews" on public.course_reviews;

create policy "Public can read approved reviews"
on public.course_reviews
for select
to anon
using (status = 'approved');

-- La publicación anónima pasa por la RPC, que siempre crea pendientes.
-- También se cierra el acceso directo aunque queden grants heredados.
alter table public.course_reviews alter column status set default 'pending';
revoke insert, update, delete on table public.course_reviews from public, anon, authenticated;
grant select on table public.course_reviews to anon;

create or replace function public.submit_course_review(
  course_id_input bigint,
  student_name_input text,
  professor_name_input text,
  term_year_input int,
  term_semester_input text,
  difficulty_input int,
  workload_input int,
  usefulness_input int,
  study_hours_input int,
  comment_input text
)
returns table (
  id bigint,
  course_id bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_review_id bigint;
  new_created_at timestamptz;
  clean_student_name text := nullif(btrim(student_name_input), '');
  clean_professor_name text := nullif(btrim(professor_name_input), '');
  clean_comment text := btrim(comment_input);
begin
  if not exists (
    select 1 from public.courses c
    where c.id = course_id_input and c.is_active = true
  ) then
    raise exception 'Ramo no disponible';
  end if;

  if clean_comment is null or char_length(clean_comment) < 20 or char_length(clean_comment) > 1500 then
    raise exception 'El comentario debe tener entre 20 y 1500 caracteres';
  end if;
  if clean_student_name is not null and char_length(clean_student_name) > 80 then
    raise exception 'El nombre o alias es demasiado largo';
  end if;
  if clean_professor_name is not null and char_length(clean_professor_name) > 120 then
    raise exception 'El nombre del profesor es demasiado largo';
  end if;
  if term_year_input is not null and (term_year_input < 2020 or term_year_input > 2035) then
    raise exception 'Año cursado inválido';
  end if;
  if term_semester_input is not null and term_semester_input not in ('1', '2', 'Verano') then
    raise exception 'Semestre cursado inválido';
  end if;
  if difficulty_input is null or difficulty_input not between 1 and 5
     or workload_input is null or workload_input not between 1 and 5
     or usefulness_input is null or usefulness_input not between 1 and 5 then
    raise exception 'Las valoraciones deben estar entre 1 y 5';
  end if;
  if study_hours_input is not null and (study_hours_input < 0 or study_hours_input > 80) then
    raise exception 'Horas de estudio inválidas';
  end if;

  insert into public.course_reviews (
    course_id, student_name, professor_name, term_year, term_semester,
    difficulty, workload, usefulness, study_hours, comment, status,
    likes_count, dislikes_count
  )
  values (
    course_id_input, clean_student_name, clean_professor_name, term_year_input,
    term_semester_input, difficulty_input, workload_input, usefulness_input,
    study_hours_input, clean_comment, 'pending', 0, 0
  )
  returning course_reviews.id, course_reviews.created_at
  into new_review_id, new_created_at;

  return query
  select new_review_id, course_id_input, new_created_at;
end;
$$;

revoke all on function public.submit_course_review(bigint,text,text,int,text,int,int,int,int,text) from public, anon, authenticated;
grant execute on function public.submit_course_review(bigint,text,text,int,text,int,int,int,int,text) to anon;


-- Registro privado de las acciones de las cuentas administradoras.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  review_id bigint,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;

-- Los reportes no se leen ni se modifican directamente desde el navegador.
create table if not exists public.course_review_reports (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.course_reviews(id) on delete cascade,
  client_token text not null check (char_length(client_token) between 10 and 120),
  reason text not null check (reason in ('offensive', 'spam', 'personal_data', 'other')),
  detail text check (detail is null or char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  unique (review_id, client_token)
);
create index if not exists idx_course_review_reports_status_created
  on public.course_review_reports(status, created_at desc);
alter table public.course_review_reports enable row level security;
revoke all on table public.course_review_reports from public, anon, authenticated;

-- Un reporte anónimo no oculta el comentario ni cambia sus valoraciones.
-- El token solo evita repetir el reporte desde el mismo navegador; no identifica personas.
create or replace function public.report_course_review(
  review_id_input bigint,
  client_token_input text,
  reason_input text,
  detail_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_detail text := nullif(btrim(detail_input), '');
  available_review bigint;
begin
  if client_token_input is null or char_length(client_token_input) not between 10 and 120 then
    raise exception 'Token inválido';
  end if;
  if reason_input is null or reason_input not in ('offensive', 'spam', 'personal_data', 'other') then
    raise exception 'Motivo de reporte inválido';
  end if;
  if clean_detail is not null and char_length(clean_detail) > 500 then
    raise exception 'El detalle debe tener como máximo 500 caracteres';
  end if;

  -- La misma fila se bloquea antes de moderar o resolver reportes.
  select r.id into available_review
  from public.course_reviews r
  join public.courses c on c.id = r.course_id
  where r.id = review_id_input and r.status = 'approved' and c.is_active = true
  for update of r;
  if available_review is null then
    raise exception 'Comentario no disponible';
  end if;

  insert into public.course_review_reports (review_id, client_token, reason, detail)
  values (available_review, client_token_input, reason_input, clean_detail)
  on conflict (review_id, client_token) do nothing;
  -- La respuesta no expone reportes, tokens ni información administrativa.
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.report_course_review(bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.report_course_review(bigint,text,text,text) to anon;

create or replace function public.admin_console_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  admin_name text;
  courses_json jsonb;
  reviews_json jsonb;
  reports_json jsonb;
  audit_json jsonb;
begin
  if caller_id is null then
    raise exception 'Autenticación requerida';
  end if;
  select a.display_name into admin_name
  from public.admin_users a
  where a.user_id = caller_id and a.is_active = true;
  if admin_name is null then
    raise exception 'Acceso administrativo no autorizado';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.semester_number, x.sort_order, x.code), '[]'::jsonb)
  into courses_json
  from (
    select c.id, c.code, c.slug, c.name, c.sort_order, s.number as semester_number
    from public.courses c
    join public.semesters s on s.id = c.semester_id
    where c.is_active = true
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.review_id desc), '[]'::jsonb)
  into reviews_json
  from (
    select r.id as review_id, r.course_id, c.code as course_code, c.slug as course_slug,
      c.name as course_name, s.number as semester_number, r.student_name, r.professor_name,
      r.term_year, r.term_semester, r.difficulty, r.workload, r.usefulness, r.study_hours,
      r.comment, r.likes_count, r.dislikes_count, r.status, r.created_at,
      ('/ramo/?c=' || c.slug) as source_page,
      (select count(*) from public.course_review_reports rr
       where rr.review_id = r.id and rr.status = 'open') as open_reports
    from public.course_reviews r
    join public.courses c on c.id = r.course_id
    join public.semesters s on s.id = c.semester_id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.report_id desc), '[]'::jsonb)
  into reports_json
  from (
    select rr.id as report_id, rr.review_id, rr.reason, rr.detail, rr.status,
      rr.created_at, rr.resolved_at, rr.resolution_note,
      coalesce(a.display_name, rr.resolved_by::text) as resolved_by_name,
      r.course_id, c.code as course_code, c.name as course_name, c.slug as course_slug,
      s.number as semester_number, r.student_name, r.professor_name,
      r.term_year, r.term_semester, r.comment, r.status as review_status
    from public.course_review_reports rr
    join public.course_reviews r on r.id = rr.review_id
    join public.courses c on c.id = r.course_id
    join public.semesters s on s.id = c.semester_id
    left join public.admin_users a on a.user_id = rr.resolved_by
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb)
  into audit_json
  from (
    select l.id, l.review_id, l.action, l.created_at, l.payload,
      coalesce(a.display_name, l.admin_user_id::text) as admin_name
    from public.admin_audit_log l
    left join public.admin_users a on a.user_id = l.admin_user_id
    order by l.created_at desc, l.id desc
    limit 100
  ) x;

  return jsonb_build_object(
    'admin', jsonb_build_object('display_name', admin_name, 'user_id', caller_id),
    'courses', courses_json, 'reviews', reviews_json, 'reports', reports_json,
    'audit', audit_json, 'generated_at', now()
  );
end;
$$;
revoke all on function public.admin_console_snapshot() from public, anon, authenticated;
grant execute on function public.admin_console_snapshot() to authenticated;

create or replace function public.admin_moderate_course_review(
  review_id_input bigint,
  target_status_input text,
  expected_status_input text,
  note_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  review_record public.course_reviews%rowtype;
  clean_note text := nullif(btrim(note_input), '');
  resolved_reports jsonb := '[]'::jsonb;
begin
  if caller_id is null or not exists (
    select 1 from public.admin_users a where a.user_id = caller_id and a.is_active = true
  ) then
    raise exception 'Acceso administrativo no autorizado';
  end if;
  if target_status_input is null or target_status_input not in ('approved', 'rejected') then
    raise exception 'Estado de moderación inválido';
  end if;
  if expected_status_input is null or expected_status_input not in ('pending', 'approved', 'rejected') then
    raise exception 'Estado esperado inválido';
  end if;
  if clean_note is not null and char_length(clean_note) > 500 then
    raise exception 'El motivo debe tener como máximo 500 caracteres';
  end if;
  if target_status_input = 'rejected' and clean_note is null then
    raise exception 'Indica el motivo del rechazo';
  end if;

  select r.* into review_record from public.course_reviews r
  where r.id = review_id_input for update;
  if not found then
    raise exception 'Comentario no encontrado';
  end if;
  if review_record.status is distinct from expected_status_input then
    raise exception 'El comentario cambió. Actualiza la consola antes de moderar';
  end if;
  if review_record.status = target_status_input then
    raise exception 'El comentario ya tiene ese estado';
  end if;
  if target_status_input = 'approved' and not exists (
    select 1 from public.courses c where c.id = review_record.course_id and c.is_active = true
  ) then
    raise exception 'El ramo no está disponible para publicar';
  end if;

  update public.course_reviews set status = target_status_input where id = review_record.id;
  if target_status_input = 'rejected' then
    select coalesce(jsonb_agg(rr.id order by rr.id), '[]'::jsonb) into resolved_reports
    from public.course_review_reports rr where rr.review_id = review_record.id and rr.status = 'open';
    update public.course_review_reports
    set status = 'resolved', resolved_by = caller_id, resolved_at = now(), resolution_note = clean_note
    where review_id = review_record.id and status = 'open';
  end if;
  insert into public.admin_audit_log (admin_user_id, action, review_id, payload)
  values (caller_id,
    case when target_status_input = 'approved' then 'approve_course_review' else 'reject_course_review' end,
    review_record.id,
    jsonb_build_object('previous_status', review_record.status, 'new_status', target_status_input,
      'note', clean_note, 'resolved_report_ids', resolved_reports));
  return jsonb_build_object('ok', true, 'review_id', review_record.id, 'status', target_status_input);
end;
$$;
revoke all on function public.admin_moderate_course_review(bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_moderate_course_review(bigint,text,text,text) to authenticated;

create or replace function public.admin_resolve_course_review_report(
  report_id_input bigint,
  target_status_input text,
  note_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  report_record public.course_review_reports%rowtype;
  locked_review bigint;
  clean_note text := nullif(btrim(note_input), '');
begin
  if caller_id is null or not exists (
    select 1 from public.admin_users a where a.user_id = caller_id and a.is_active = true
  ) then
    raise exception 'Acceso administrativo no autorizado';
  end if;
  if target_status_input is null or target_status_input not in ('resolved', 'dismissed') then
    raise exception 'Estado de reporte inválido';
  end if;
  if clean_note is null or char_length(clean_note) > 500 then
    raise exception 'Indica un motivo de hasta 500 caracteres';
  end if;

  select r.id into locked_review from public.course_reviews r
  where r.id = (select rr.review_id from public.course_review_reports rr where rr.id = report_id_input)
  for update;
  select rr.* into report_record from public.course_review_reports rr
  where rr.id = report_id_input for update;
  if not found or locked_review is null then
    raise exception 'Reporte no encontrado';
  end if;
  if report_record.status <> 'open' then
    raise exception 'El reporte ya fue revisado. Actualiza la consola';
  end if;

  update public.course_review_reports
  set status = target_status_input, resolved_by = caller_id, resolved_at = now(), resolution_note = clean_note
  where id = report_record.id;
  insert into public.admin_audit_log (admin_user_id, action, review_id, payload)
  values (caller_id, 'resolve_course_review_report', report_record.review_id,
    jsonb_build_object('report_id', report_record.id, 'previous_status', report_record.status,
      'new_status', target_status_input, 'note', clean_note));
  return jsonb_build_object('ok', true, 'report_id', report_record.id, 'status', target_status_input);
end;
$$;
revoke all on function public.admin_resolve_course_review_report(bigint,text,text) from public, anon, authenticated;
grant execute on function public.admin_resolve_course_review_report(bigint,text,text) to authenticated;

create or replace function public.admin_delete_course_review(review_id_input bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  review_record jsonb;
  reports_json jsonb;
begin
  if caller_id is null or not exists (
    select 1 from public.admin_users a where a.user_id = caller_id and a.is_active = true
  ) then
    raise exception 'Acceso administrativo no autorizado';
  end if;

  perform 1 from public.course_reviews r where r.id = review_id_input for update;
  if not found then
    raise exception 'Comentario no encontrado';
  end if;
  select to_jsonb(x) into review_record from (
    select r.*, c.code as course_code, c.name as course_name
    from public.course_reviews r join public.courses c on c.id = r.course_id
    where r.id = review_id_input
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into reports_json from (
    select rr.id, rr.reason, rr.detail, rr.status, rr.created_at, rr.resolved_at,
      rr.resolved_by, rr.resolution_note
    from public.course_review_reports rr where rr.review_id = review_id_input
  ) x;

  -- El borrado conserva en auditoría el comentario y sus reportes, sin tokens.
  insert into public.admin_audit_log (admin_user_id, action, review_id, payload)
  values (caller_id, 'delete_course_review', review_id_input,
    jsonb_build_object('review', review_record, 'reports', reports_json));
  delete from public.course_reviews where id = review_id_input;
  return jsonb_build_object('ok', true, 'review_id', review_id_input, 'deleted_at', now());
end;
$$;
revoke all on function public.admin_delete_course_review(bigint) from public, anon, authenticated;
grant execute on function public.admin_delete_course_review(bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
