from django.db import migrations
from django.utils.text import slugify


# Base editorial del nuevo plan de 10 semestres publicado por el Departamento de
# Electrónica. Las siglas se completan solo cuando están verificadas/ya usadas por
# la comunidad; el resto puede editarse desde el admin sin tocar código.
COURSES = [
    (1, 'HXW006', 'Comunicación efectiva en español / inglés I', 'Formación transversal'),
    (1, 'EFI200', 'Educación Física I', 'Formación transversal'),
    (1, 'IWG400', 'Proyecto Inicial', 'Proyectos'),
    (1, 'FIS100', 'Introducción a la Física', 'Ciencias básicas'),
    (1, 'MAT070', 'Introducción al Cálculo', 'Matemática'),
    (1, 'MAT060', 'Álgebra y Geometría', 'Matemática'),
    (2, 'HXW007', 'Comunicación efectiva en español / inglés II', 'Formación transversal'),
    (2, 'EFI201', 'Educación Física II', 'Formación transversal'),
    (2, 'INF129', 'Introducción a la Programación', 'Programación'),
    (2, '', 'Física General Mecánica', 'Ciencias básicas'),
    (2, 'MAT071', 'Cálculo en una Variable', 'Matemática'),
    (2, 'MAT061', 'Álgebra Lineal', 'Matemática'),
    (3, '', 'Análisis Crítico de Texto', 'Formación transversal'),
    (3, '', 'Redes de Computadores', 'Redes'),
    (3, '', 'Seminario de Programación', 'Programación'),
    (3, '', 'Electricidad y Magnetismo', 'Ciencias básicas'),
    (3, '', 'Cálculo en Varias Variables', 'Matemática'),
    (3, '', 'Ecuaciones Diferenciales Elementales', 'Matemática'),
    (4, '', 'Comunicación efectiva en español / inglés III', 'Formación transversal'),
    (4, '', 'Electrónica Digital', 'Electrónica'),
    (4, '', 'Algorítmica y Complejidad', 'Programación'),
    (4, '', 'Laboratorio de Redes de Computadores', 'Redes'),
    (4, '', 'Laboratorio de Electrónica Digital', 'Electrónica'),
    (4, '', 'Calor y Ondas', 'Ciencias básicas'),
    (5, '', 'Práctica de Acción Comunitaria', 'Formación transversal'),
    (5, '', 'Administración y Sostenibilidad Organizacional', 'Gestión'),
    (5, '', 'Administración de Redes', 'Redes'),
    (5, '', 'Sistemas Digitales y Estructura Computadores', 'Electrónica'),
    (5, '', 'Base de Datos', 'Programación'),
    (5, '', 'Fundamentos de Transmisión Señales', 'Telecomunicaciones'),
    (6, '', 'Comunicación efectiva en español / inglés IV', 'Formación transversal'),
    (6, '', 'Ingeniería Económica', 'Gestión'),
    (6, '', 'Análisis y Diseño de Software', 'Programación'),
    (6, '', 'Sistemas Operativos', 'Programación'),
    (6, '', 'Estadística Computacional', 'Matemática'),
    (6, '', 'Principios de Comunicaciones', 'Telecomunicaciones'),
    (7, '', 'Inglés Disciplinar', 'Formación transversal'),
    (7, '', 'Disponibilidad y Rendimiento de Sistemas TIC', 'Redes'),
    (7, '', 'Ingeniería de Software', 'Programación'),
    (7, '', 'Laboratorio de Comunicaciones', 'Telecomunicaciones'),
    (7, '', 'Optimización', 'Matemática'),
    (7, '', 'Ciencia de Datos', 'Datos'),
    (8, '', 'Electivo', 'Electivos'),
    (8, '', 'Pensamiento de Diseño de Ingeniería', 'Proyectos'),
    (8, '', 'Ingeniería en Ciberseguridad', 'Ciberseguridad'),
    (8, '', 'Planificación de Infraestructura Telemática', 'Redes'),
    (8, '', 'Aplicaciones Web y Móviles', 'Programación'),
    (8, '', 'Procesamiento Digital de Imágenes', 'Datos'),
    (9, '', 'Electivo', 'Electivos'),
    (9, '', 'Gestión de la Innovación', 'Gestión'),
    (9, '', 'Electivo Disciplinar I', 'Electivos'),
    (9, '', 'Electivo Disciplinar II', 'Electivos'),
    (9, '', 'Electivo Disciplinar III', 'Electivos'),
    (9, '', 'Taller Memoria I', 'Titulación'),
    (10, '', 'Electivo Disciplinar IV', 'Electivos'),
    (10, '', 'Gestión del Emprendimiento', 'Gestión'),
    (10, '', 'Electivo Disciplinar V', 'Electivos'),
    (10, '', 'Electivo Disciplinar VI', 'Electivos'),
    (10, '', 'Taller Memoria II', 'Titulación'),
]

# Relaciones de continuidad que alimentan “ramo previo / siguiente”. Son explícitas
# para evitar inferir vecinos por posición visual. La relación FIS100 → MAT070 →
# IWG400 se mantiene tal como fue solicitada para la navegación de la comunidad.
PROGRESSION_CHAINS = [
    ['FIS100', 'MAT070', 'IWG400'],
    ['HXW006', 'HXW007', 'Comunicación efectiva en español / inglés III', 'Comunicación efectiva en español / inglés IV', 'Inglés Disciplinar'],
    ['EFI200', 'EFI201'],
    ['MAT060', 'MAT061', 'Cálculo en Varias Variables', 'Ecuaciones Diferenciales Elementales', 'Estadística Computacional', 'Optimización'],
    ['FIS100', 'Física General Mecánica', 'Electricidad y Magnetismo', 'Calor y Ondas', 'Fundamentos de Transmisión Señales', 'Principios de Comunicaciones', 'Laboratorio de Comunicaciones'],
    ['INF129', 'Seminario de Programación', 'Algorítmica y Complejidad', 'Base de Datos', 'Análisis y Diseño de Software', 'Ingeniería de Software', 'Aplicaciones Web y Móviles'],
    ['Redes de Computadores', 'Laboratorio de Redes de Computadores', 'Administración de Redes', 'Disponibilidad y Rendimiento de Sistemas TIC', 'Planificación de Infraestructura Telemática', 'Ingeniería en Ciberseguridad'],
    ['Electrónica Digital', 'Laboratorio de Electrónica Digital', 'Sistemas Digitales y Estructura Computadores'],
    ['Administración y Sostenibilidad Organizacional', 'Ingeniería Económica', 'Gestión de la Innovación', 'Gestión del Emprendimiento'],
    ['Taller Memoria I', 'Taller Memoria II'],
]


def seed_courses(apps, schema_editor):
    Course = apps.get_model('dashboard', 'Course')
    Progression = apps.get_model('dashboard', 'CourseProgression')
    created = {}
    used_slugs = set(Course.objects.values_list('slug', flat=True))
    duplicate_name_counts = {}

    for sem, code, name, area in COURSES:
        duplicate_name_counts[name] = duplicate_name_counts.get(name, 0) + 1
        identity = code or f'{name}__s{sem}__{duplicate_name_counts[name]}'
        base = slugify(f'{code}-{name}' if code else f'{name}-s{sem}')[:200] or 'ramo'
        slug = base
        i = 2
        while slug in used_slugs:
            slug = f'{base}-{i}'
            i += 1
        used_slugs.add(slug)
        lookup = {'code': code, 'name': name, 'plan_year': 2025}
        if not code and name == 'Electivo':
            lookup['semester'] = sem
        defaults = {
            'slug': slug,
            'semester': sem,
            'area': area,
            'summary': f'Ficha colaborativa de {name}. DIFTEL puede centralizar aquí apuntes, evaluaciones históricas, material de estudio y experiencias de estudiantes.',
        }
        obj, _ = Course.objects.get_or_create(defaults=defaults, **lookup)
        changed = False
        if obj.semester != sem:
            obj.semester = sem
            changed = True
        if not obj.area:
            obj.area = area
            changed = True
        if changed:
            obj.save(update_fields=['semester', 'area'])
        created[identity] = obj
        if code:
            created[code] = obj
        if name != 'Electivo':
            created[name] = obj

    order = 1
    for chain in PROGRESSION_CHAINS:
        for from_key, to_key in zip(chain, chain[1:]):
            from_course = created.get(from_key)
            to_course = created.get(to_key)
            if not from_course or not to_course or from_course.pk == to_course.pk:
                continue
            Progression.objects.get_or_create(
                from_course=from_course,
                to_course=to_course,
                relationship_type='progression',
                defaults={'order': order, 'note': 'Continuidad de progresión cargada por DIFTEL; revisar si cambia el plan oficial.'},
            )
            order += 1


def reverse_seed(apps, schema_editor):
    Course = apps.get_model('dashboard', 'Course')
    for sem, code, name, _area in COURSES:
        query = Course.objects.filter(plan_year=2025, code=code, name=name)
        if not code and name == 'Electivo':
            query = query.filter(semester=sem)
        query.delete()


class Migration(migrations.Migration):
    dependencies = [('dashboard', '0008_portal_expansion')]
    operations = [migrations.RunPython(seed_courses, reverse_seed)]
