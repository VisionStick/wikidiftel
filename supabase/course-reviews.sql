-- WikiDIFTEL · comentarios + reacciones (Me gusta / No me gusta)
-- PEGAR ESTE ARCHIVO EN: Supabase > SQL Editor > New query > Run
-- Es idempotente: se puede volver a ejecutar sin borrar comentarios existentes.

-- 1) Completa/normaliza la tabla de comentarios.
alter table public.course_reviews add column if not exists student_name text;
alter table public.course_reviews add column if not exists term_year int;
alter table public.course_reviews add column if not exists term_semester text;
alter table public.course_reviews add column if not exists study_hours int;

-- Contadores cacheados. La fuente real de cada voto es course_review_reactions.
alter table public.course_reviews add column if not exists likes_count int not null default 0;
alter table public.course_reviews add column if not exists dislikes_count int not null default 0;

alter table public.course_reviews drop constraint if exists course_reviews_term_year_check;
alter table public.course_reviews add constraint course_reviews_term_year_check
  check (term_year is null or term_year between 2020 and 2035);

alter table public.course_reviews drop constraint if exists course_reviews_term_semester_check;
alter table public.course_reviews add constraint course_reviews_term_semester_check
  check (term_semester is null or term_semester in ('1', '2', 'Verano'));

alter table public.course_reviews drop constraint if exists course_reviews_study_hours_check;
alter table public.course_reviews add constraint course_reviews_study_hours_check
  check (study_hours is null or study_hours between 0 and 80);

alter table public.course_reviews drop constraint if exists course_reviews_likes_count_check;
alter table public.course_reviews add constraint course_reviews_likes_count_check
  check (likes_count >= 0);

alter table public.course_reviews drop constraint if exists course_reviews_dislikes_count_check;
alter table public.course_reviews add constraint course_reviews_dislikes_count_check
  check (dislikes_count >= 0);

create index if not exists idx_course_reviews_created_at
  on public.course_reviews(created_at desc);
create index if not exists idx_course_reviews_course_status
  on public.course_reviews(course_id, status, created_at desc);

-- 2) Una sola tabla para ambas reacciones.
-- UNIQUE(review_id, client_token) impide que un navegador vote dos veces
-- el mismo comentario y permite cambiar 👍 <-> 👎.
create table if not exists public.course_review_reactions (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.course_reviews(id) on delete cascade,
  client_token text not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, client_token)
);

create index if not exists idx_course_review_reactions_review_id
  on public.course_review_reactions(review_id);
create index if not exists idx_course_review_reactions_review_reaction
  on public.course_review_reactions(review_id, reaction);

-- Si ya existían likes del sistema anterior, los conservamos.
-- El bloque dinámico evita fallar si course_review_likes nunca fue creada.
do $
begin
  if to_regclass('public.course_review_likes') is not null then
    execute $migrate$
      insert into public.course_review_reactions (review_id, client_token, reaction)
      select review_id, client_token, 'like'
      from public.course_review_likes
      on conflict (review_id, client_token) do nothing
    $migrate$;
  end if;
end
$;

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
  and difficulty between 1 and 5
  and workload between 1 and 5
  and usefulness between 1 and 5
  and (study_hours is null or study_hours between 0 and 80)
  and likes_count = 0
  and dislikes_count = 0
  and exists (
    select 1
    from public.courses c
    where c.id = course_id and c.is_active = true
  )
);

-- Las reacciones se escriben SOLO mediante RPC. No exponemos client_token.
revoke all on table public.course_review_reactions from anon;
grant usage on schema public to anon;

-- Cierra lectura pública de la tabla antigua de likes, si existe.
do $$
begin
  if to_regclass('public.course_review_likes') is not null then
    execute 'drop policy if exists "Public can read review likes" on public.course_review_likes';
    execute 'drop policy if exists "Public can like approved reviews" on public.course_review_likes';
    execute 'revoke all on table public.course_review_likes from anon';
  end if;
end
$$;

-- 4) Sincroniza contadores con las reacciones reales.
update public.course_reviews r
set
  likes_count = coalesce(x.likes_count, 0),
  dislikes_count = coalesce(x.dislikes_count, 0)
from (
  select
    cr.id as review_id,
    count(rr.id) filter (where rr.reaction = 'like')::int as likes_count,
    count(rr.id) filter (where rr.reaction = 'dislike')::int as dislikes_count
  from public.course_reviews cr
  left join public.course_review_reactions rr on rr.review_id = cr.id
  group by cr.id
) x
where x.review_id = r.id;

-- 5) Vista que consume la web.
-- dislikes_count se agrega AL FINAL para que CREATE OR REPLACE sea compatible
-- con instalaciones que ya tienen la versión anterior de la vista.
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
  r.likes_count,
  r.created_at,
  r.status,
  r.dislikes_count
from public.course_reviews r
join public.courses c on c.id = r.course_id
where r.status = 'approved'
  and c.is_active = true;

grant select on public.course_review_public_view to anon;

-- 6) RPC única para 👍 y 👎.
-- Comportamiento:
--   sin reacción + 👍 => agrega 👍
--   👍 + 👍 => quita 👍
--   👍 + 👎 => cambia a 👎
-- y viceversa.
create or replace function public.set_course_review_reaction(
  review_id_input bigint,
  client_token_input text,
  reaction_input text
)
returns table (
  review_id bigint,
  likes_count int,
  dislikes_count int,
  reaction text,
  action text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_reaction text;
  final_reaction text;
  like_total int;
  dislike_total int;
  action_value text;
begin
  if client_token_input is null
     or char_length(client_token_input) < 10
     or char_length(client_token_input) > 120 then
    raise exception 'Token inválido';
  end if;

  if reaction_input not in ('like', 'dislike') then
    raise exception 'Reacción inválida';
  end if;

  if not exists (
    select 1
    from public.course_reviews r
    where r.id = review_id_input
      and r.status = 'approved'
  ) then
    raise exception 'Comentario no disponible';
  end if;

  select rr.reaction
  into current_reaction
  from public.course_review_reactions rr
  where rr.review_id = review_id_input
    and rr.client_token = client_token_input;

  if current_reaction = reaction_input then
    delete from public.course_review_reactions rr
    where rr.review_id = review_id_input
      and rr.client_token = client_token_input;
    final_reaction := null;
    action_value := 'removed';
  else
    insert into public.course_review_reactions (
      review_id, client_token, reaction, updated_at
    )
    values (
      review_id_input, client_token_input, reaction_input, now()
    )
    on conflict (review_id, client_token)
    do update set
      reaction = excluded.reaction,
      updated_at = now();

    final_reaction := reaction_input;
    action_value := case
      when current_reaction is null then 'added'
      else 'changed'
    end;
  end if;

  select
    count(*) filter (where rr.reaction = 'like')::int,
    count(*) filter (where rr.reaction = 'dislike')::int
  into like_total, dislike_total
  from public.course_review_reactions rr
  where rr.review_id = review_id_input;

  update public.course_reviews r
  set
    likes_count = coalesce(like_total, 0),
    dislikes_count = coalesce(dislike_total, 0)
  where r.id = review_id_input;

  return query
  select
    review_id_input,
    coalesce(like_total, 0),
    coalesce(dislike_total, 0),
    final_reaction,
    action_value;
end;
$$;

revoke all on function public.set_course_review_reaction(bigint, text, text) from public;
grant execute on function public.set_course_review_reaction(bigint, text, text) to anon;

-- 7) Compatibilidad con la web antigua que todavía llame like_course_review().
create or replace function public.like_course_review(
  review_id_input bigint,
  client_token_input text
)
returns table (
  review_id bigint,
  likes_count int,
  inserted boolean
)
language sql
security definer
set search_path = public
as $$
  select
    x.review_id,
    x.likes_count,
    (x.reaction = 'like') as inserted
  from public.set_course_review_reaction(
    review_id_input,
    client_token_input,
    'like'
  ) x;
$$;

revoke all on function public.like_course_review(bigint, text) from public;
grant execute on function public.like_course_review(bigint, text) to anon;

-- 8) Comprobación final. Si este SELECT devuelve filas/0 filas sin error,
-- la estructura quedó instalada correctamente.
select
  id,
  course_id,
  course_code,
  likes_count,
  dislikes_count,
  created_at
from public.course_review_public_view
order by created_at desc
limit 20;
