-- WikiDIFTEL · comentarios de ramos
-- Migración idempotente: se puede ejecutar completa varias veces en Supabase SQL Editor.
-- Mantiene course_reviews normalizada: los Me gusta viven en course_review_likes.

alter table public.course_reviews
add column if not exists student_name text;

alter table public.course_reviews
add column if not exists term_year int;

alter table public.course_reviews
add column if not exists term_semester text;

alter table public.course_reviews
add column if not exists study_hours int;

-- Normaliza restricciones sin depender de cómo fue creada originalmente la tabla.
alter table public.course_reviews drop constraint if exists course_reviews_term_year_check;
alter table public.course_reviews add constraint course_reviews_term_year_check
  check (term_year is null or term_year between 2020 and 2035);

alter table public.course_reviews drop constraint if exists course_reviews_term_semester_check;
alter table public.course_reviews add constraint course_reviews_term_semester_check
  check (term_semester is null or term_semester in ('1', '2', 'Verano'));

alter table public.course_reviews drop constraint if exists course_reviews_study_hours_check;
alter table public.course_reviews add constraint course_reviews_study_hours_check
  check (study_hours is null or study_hours between 0 and 80);

create index if not exists idx_course_reviews_created_at on public.course_reviews(created_at desc);
create index if not exists idx_course_reviews_course_status on public.course_reviews(course_id, status, created_at desc);

create table if not exists public.course_review_likes (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.course_reviews(id) on delete cascade,
  client_token text not null,
  created_at timestamptz not null default now(),
  unique (review_id, client_token)
);

create index if not exists idx_course_review_likes_review_id on public.course_review_likes(review_id);

alter table public.course_reviews enable row level security;
alter table public.course_review_likes enable row level security;

drop policy if exists "Public can read approved reviews" on public.course_reviews;
drop policy if exists "Public can submit pending reviews" on public.course_reviews;
drop policy if exists "Public can submit approved reviews" on public.course_reviews;

create policy "Public can read approved reviews"
on public.course_reviews
for select
to anon
using (status = 'approved');

create policy "Public can submit approved reviews"
on public.course_reviews
for insert
to anon
with check (
  status = 'approved'
  and char_length(comment) between 20 and 1500
  and (student_name is null or char_length(student_name) <= 80)
  and (professor_name is null or char_length(professor_name) <= 120)
  and (term_year is null or term_year between 2020 and 2035)
  and (term_semester is null or term_semester in ('1', '2', 'Verano'))
  and (difficulty between 1 and 5)
  and (workload between 1 and 5)
  and (usefulness between 1 and 5)
  and (study_hours is null or study_hours between 0 and 80)
  and exists (
    select 1 from public.courses c
    where c.id = course_id and c.is_active = true
  )
);

drop policy if exists "Public can read review likes" on public.course_review_likes;
drop policy if exists "Public can like approved reviews" on public.course_review_likes;

create policy "Public can read review likes"
on public.course_review_likes
for select
to anon
using (true);

create policy "Public can like approved reviews"
on public.course_review_likes
for insert
to anon
with check (
  char_length(client_token) between 10 and 120
  and exists (
    select 1 from public.course_reviews r
    where r.id = review_id and r.status = 'approved'
  )
);

-- Vista estable para el frontend. El contador se deriva de course_review_likes:
-- no duplicamos el mismo dato dentro de course_reviews.
create or replace view public.course_review_public_view
with (security_invoker = true)
as
select
  r.id,
  r.course_id,
  c.code as course_code,
  c.slug as course_slug,
  c.name as course_name,
  r.student_name,
  r.professor_name,
  r.term_year,
  r.term_semester,
  r.difficulty,
  r.workload,
  r.usefulness,
  r.study_hours,
  r.comment,
  count(l.id)::int as likes_count,
  r.created_at,
  r.status
from public.course_reviews r
join public.courses c on c.id = r.course_id
left join public.course_review_likes l on l.review_id = r.id
where r.status = 'approved'
  and c.is_active = true
group by
  r.id, r.course_id, c.code, c.slug, c.name, r.student_name, r.professor_name,
  r.term_year, r.term_semester, r.difficulty, r.workload, r.usefulness,
  r.study_hours, r.comment, r.created_at, r.status;

grant select on public.course_review_public_view to anon;

create or replace function public.like_course_review(
  review_id_input bigint,
  client_token_input text
)
returns table (review_id bigint, likes_count int, inserted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row boolean := false;
begin
  if client_token_input is null
     or char_length(client_token_input) < 10
     or char_length(client_token_input) > 120 then
    raise exception 'Token inválido';
  end if;

  if not exists (
    select 1 from public.course_reviews r
    where r.id = review_id_input and r.status = 'approved'
  ) then
    raise exception 'Comentario no disponible';
  end if;

  insert into public.course_review_likes (review_id, client_token)
  values (review_id_input, client_token_input)
  on conflict (review_id, client_token) do nothing;

  get diagnostics inserted_row = row_count;

  return query
  select
    review_id_input,
    count(*)::int,
    inserted_row
  from public.course_review_likes
  where review_id = review_id_input;
end;
$$;

revoke all on function public.like_course_review(bigint, text) from public;
grant execute on function public.like_course_review(bigint, text) to anon;

-- Diagnóstico rápido opcional:
-- select id, code, slug, name from public.courses where code = 'FIS11125';
-- select * from public.course_review_public_view where course_code = 'FIS11125' order by created_at desc;
