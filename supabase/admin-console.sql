-- Wiki DIFTEL: autorización de la consola administrativa.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Administrador',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

insert into public.admin_users (user_id, display_name, is_active)
values ('d7c1c339-f041-4b2f-b0d9-d0591458b412'::uuid, 'Administrador Wiki DIFTEL', true)
on conflict (user_id) do update
set display_name = excluded.display_name, is_active = true;

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
      ('/ramo/?c=' || c.slug) as source_page
    from public.course_reviews r
    join public.courses c on c.id = r.course_id
    join public.semesters s on s.id = c.semester_id
  ) x;

  return jsonb_build_object(
    'admin', jsonb_build_object('display_name', admin_name, 'user_id', caller_id),
    'courses', courses_json,
    'reviews', reviews_json,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.admin_console_snapshot() from public, anon;
grant execute on function public.admin_console_snapshot() to authenticated;
notify pgrst, 'reload schema';

-- Auditoría de acciones administrativas.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  review_id bigint,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;

create or replace function public.admin_delete_course_review(review_id_input bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  review_record jsonb;
begin
  if caller_id is null then
    raise exception 'Autenticación requerida';
  end if;

  if not exists (
    select 1 from public.admin_users a
    where a.user_id = caller_id and a.is_active = true
  ) then
    raise exception 'Acceso administrativo no autorizado';
  end if;

  select to_jsonb(x) into review_record
  from (
    select r.*, c.code as course_code, c.name as course_name
    from public.course_reviews r
    join public.courses c on c.id = r.course_id
    where r.id = review_id_input
  ) x;

  if review_record is null then
    raise exception 'Comentario no encontrado';
  end if;

  insert into public.admin_audit_log (admin_user_id, action, review_id, payload)
  values (caller_id, 'delete_course_review', review_id_input, review_record);

  delete from public.course_reviews
  where id = review_id_input;

  return jsonb_build_object(
    'ok', true,
    'review_id', review_id_input,
    'deleted_at', now()
  );
end;
$$;

revoke all on function public.admin_delete_course_review(bigint) from public, anon;
grant execute on function public.admin_delete_course_review(bigint) to authenticated;

notify pgrst, 'reload schema';
