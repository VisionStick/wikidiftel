-- WikiDIFTEL · Supabase schema
-- Fuente única para semestres, áreas, colores y fichas de ramos.

create table if not exists public.semesters (
  id bigint generated always as identity primary key,
  number int not null unique check (number between 1 and 10),
  name text not null,
  sort_order int not null
);

create table if not exists public.academic_areas (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id bigint generated always as identity primary key,
  semester_id bigint not null references public.semesters(id) on delete restrict,
  area_id bigint not null references public.academic_areas(id) on delete restrict,
  code text not null unique,
  slug text not null unique,
  name text not null,
  sct int check (sct is null or sct > 0),
  summary text,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = upper(code))
);

create table if not exists public.course_libraries (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  title text not null,
  url text not null,
  type text not null default 'biblioteca',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.course_reviews (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  professor_name text,
  difficulty int check (difficulty between 1 and 5),
  workload int check (workload between 1 and 5),
  usefulness int check (usefulness between 1 and 5),
  comment text not null check (char_length(comment) between 20 and 1500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.professors (
  id bigint generated always as identity primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_professors (
  course_id bigint not null references public.courses(id) on delete cascade,
  professor_id bigint not null references public.professors(id) on delete cascade,
  primary key (course_id, professor_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists set_academic_areas_updated_at on public.academic_areas;
create trigger set_academic_areas_updated_at
before update on public.academic_areas
for each row execute function public.set_updated_at();

drop trigger if exists set_professors_updated_at on public.professors;
create trigger set_professors_updated_at
before update on public.professors
for each row execute function public.set_updated_at();

create index if not exists idx_courses_semester_id on public.courses(semester_id);
create index if not exists idx_courses_area_id on public.courses(area_id);
create index if not exists idx_courses_code on public.courses(code);
create index if not exists idx_courses_slug on public.courses(slug);
create index if not exists idx_courses_active on public.courses(is_active);
create index if not exists idx_course_libraries_course_id on public.course_libraries(course_id);
create index if not exists idx_course_reviews_course_id on public.course_reviews(course_id);
create index if not exists idx_course_reviews_status on public.course_reviews(status);
create index if not exists idx_course_professors_course_id on public.course_professors(course_id);
create index if not exists idx_course_professors_professor_id on public.course_professors(professor_id);

alter table public.semesters enable row level security;
alter table public.academic_areas enable row level security;
alter table public.courses enable row level security;
alter table public.course_libraries enable row level security;
alter table public.course_reviews enable row level security;
alter table public.professors enable row level security;
alter table public.course_professors enable row level security;

drop policy if exists "Public can read semesters" on public.semesters;
drop policy if exists "Public can read active academic areas" on public.academic_areas;
drop policy if exists "Public can read active courses" on public.courses;
drop policy if exists "Public can read active libraries" on public.course_libraries;
drop policy if exists "Public can read approved reviews" on public.course_reviews;
drop policy if exists "Public can submit pending reviews" on public.course_reviews;
drop policy if exists "Public can read active professors" on public.professors;
drop policy if exists "Public can read active course professors" on public.course_professors;

create policy "Public can read semesters"
on public.semesters
for select
to anon
using (true);

create policy "Public can read active academic areas"
on public.academic_areas
for select
to anon
using (is_active = true);

create policy "Public can read active courses"
on public.courses
for select
to anon
using (is_active = true);

create policy "Public can read active libraries"
on public.course_libraries
for select
to anon
using (is_active = true);

create policy "Public can read approved reviews"
on public.course_reviews
for select
to anon
using (status = 'approved');

create policy "Public can submit pending reviews"
on public.course_reviews
for insert
to anon
with check (
  status = 'pending'
  and char_length(comment) between 20 and 1500
);

create policy "Public can read active professors"
on public.professors
for select
to anon
using (is_active = true);

create policy "Public can read active course professors"
on public.course_professors
for select
to anon
using (
  exists (
    select 1
    from public.courses c
    where c.id = course_id
    and c.is_active = true
  )
  and exists (
    select 1
    from public.professors p
    where p.id = professor_id
    and p.is_active = true
  )
);

create or replace view public.course_full_view as
select
  c.id,
  c.code,
  c.slug,
  c.name,
  c.sct,
  c.summary,
  c.description,
  c.sort_order,
  c.is_active,
  c.created_at,
  c.updated_at,
  s.id as semester_id,
  s.number as semester_number,
  s.name as semester_name,
  s.sort_order as semester_sort_order,
  a.id as area_id,
  a.name as area_name,
  a.slug as area_slug,
  a.color_hex as area_color,
  a.sort_order as area_sort_order
from public.courses c
join public.semesters s on s.id = c.semester_id
join public.academic_areas a on a.id = c.area_id;

insert into public.semesters (number, name, sort_order) values
(1, 'Semestre 1', 1),
(2, 'Semestre 2', 2),
(3, 'Semestre 3', 3),
(4, 'Semestre 4', 4),
(5, 'Semestre 5', 5),
(6, 'Semestre 6', 6),
(7, 'Semestre 7', 7),
(8, 'Semestre 8', 8),
(9, 'Semestre 9', 9),
(10, 'Semestre 10', 10)
on conflict (number) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.academic_areas (name, slug, color_hex, sort_order) values
('Comunicación & Humanidades', 'comunicacion-humanidades', '#d8ea35', 1),
('Ciencias Sociales & Económicas', 'ciencias-sociales-economicas', '#9ac441', 2),
('Ciencias Básicas', 'ciencias-basicas', '#cf3638', 3),
('Ciencias de la Ingeniería', 'ciencias-de-la-ingenieria', '#d3aa30', 4),
('Especialidad', 'especialidad', '#6586c8', 5),
('Competencias Transversales Sello', 'competencias-transversales-sello', '#c58cc1', 6),
('Electivos', 'electivos', '#8455a6', 7)
on conflict (slug) do update set
  name = excluded.name,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order,
  is_active = true;
