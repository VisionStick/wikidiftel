import json
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta
from random import randrange

from decouple import config
from django.contrib import messages
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Avg, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import (
    COMMUNITY_CATEGORY_CHOICES,
    COURSE_RESOURCE_CHOICES,
    EVENT_TYPE_CHOICES,
    PROJECT_ORIGIN_CHOICES,
    STUDENT_PROJECT_TYPE_CHOICES,
    CommunityEvent,
    CommunityMember,
    Course,
    CourseResource,
    CourseReview,
    InitialProject,
    USMUser,
    Workshop,
)


def _is_htmx(request):
    return (
        bool(getattr(request, 'htmx', False))
        or request.headers.get('HX-Request') == 'true'
        or request.GET.get('partial') in ('1', 'true', 'True')
    )


def buzon_page_view(request):
    """Serve the buzón UI when running Django directly in local development."""
    return render(request, 'dashboard/buzon.html')


def landing_view(request):
    latest_projects = InitialProject.objects.prefetch_related('images').all()[:3]
    latest_workshops = Workshop.objects.prefetch_related('images').all()[:3]
    latest_community = CommunityEvent.objects.prefetch_related('media').all()[:4]
    context = {
        'latest_projects': latest_projects,
        'latest_workshops': latest_workshops,
        'latest_community': latest_community,
        'project_count': InitialProject.objects.count(),
        'workshop_count': Workshop.objects.count(),
        'course_count': Course.objects.count(),
        'community_count': CommunityEvent.objects.count(),
    }
    return render(request, 'dashboard/landing.html', context)


def initial_projects_view(request):
    generations = InitialProject.objects.values_list('generation', flat=True).distinct().order_by('-generation')
    selected_generation = _parse_year_param(request.GET.get('generation'))
    selected_origin = request.GET.get('origin') or ''
    selected_type = request.GET.get('type') or ''
    search_query = (request.GET.get('q') or '').strip()

    projects = InitialProject.objects.prefetch_related('images', 'videos').all()
    if selected_generation:
        projects = projects.filter(generation=selected_generation)
    if selected_origin in dict(PROJECT_ORIGIN_CHOICES):
        projects = projects.filter(origin=selected_origin)
    else:
        selected_origin = ''
    if selected_type in dict(STUDENT_PROJECT_TYPE_CHOICES) and selected_origin != 'diftel':
        projects = projects.filter(student_project_type=selected_type, origin='student')
        selected_origin = 'student'
    else:
        selected_type = ''
    if search_query:
        projects = projects.filter(
            Q(title__icontains=search_query)
            | Q(description__icontains=search_query)
            | Q(members__icontains=search_query)
            | Q(course_code__icontains=search_query)
            | Q(course_name__icontains=search_query)
            | Q(technologies__icontains=search_query)
        )

    context = {
        'projects': projects,
        'generations': generations,
        'selected_generation': selected_generation,
        'selected_origin': selected_origin,
        'selected_type': selected_type,
        'search_query': search_query,
        'project_origins': PROJECT_ORIGIN_CHOICES,
        'student_project_types': STUDENT_PROJECT_TYPE_CHOICES,
        'diftel_count': InitialProject.objects.filter(origin='diftel').count(),
        'student_count': InitialProject.objects.filter(origin='student').count(),
    }
    return render(request, 'dashboard/initial_projects.html', context)


def initial_projects_list_view(request, generation):
    projects = InitialProject.objects.filter(generation=generation).prefetch_related('images', 'videos')
    return render(request, 'dashboard/partials/initial_projects_list.html', {
        'projects': projects,
        'generation': generation,
    })


def project_detail_view(request, pk):
    project = get_object_or_404(InitialProject.objects.prefetch_related('images', 'videos'), pk=pk)
    related = InitialProject.objects.exclude(pk=project.pk).filter(origin=project.origin).prefetch_related('images')[:3]
    return render(request, 'dashboard/project_detail.html', {'project': project, 'related_projects': related})


def _parse_year_param(year_val):
    if not year_val:
        return None
    val_str = str(year_val).strip().lower()
    if val_str in ('all', 'todos', ''):
        return None
    try:
        val = int(val_str)
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def workshops_view(request, year=None):
    year_param = year if year is not None else request.GET.get('year')
    selected_year = _parse_year_param(year_param)
    event_type = request.GET.get('event_type') or request.GET.get('type')
    search_query = (request.GET.get('q') or '').strip()

    workshops = Workshop.objects.all().prefetch_related('images', 'videos').order_by('-featured', '-year', '-created_at', '-id')
    if selected_year is not None:
        workshops = workshops.filter(year=selected_year)
    if event_type and event_type in dict(EVENT_TYPE_CHOICES):
        workshops = workshops.filter(event_type=event_type)
    else:
        event_type = None
    if search_query:
        workshops = workshops.filter(
            Q(title__icontains=search_query)
            | Q(description__icontains=search_query)
            | Q(tagline__icontains=search_query)
            | Q(organizations__icontains=search_query)
            | Q(involved_people__icontains=search_query)
        )

    years = Workshop.objects.values_list('year', flat=True).distinct().order_by('-year')
    context = {
        'workshops': workshops,
        'years': years,
        'active_year': selected_year,
        'selected_year': selected_year,
        'event_types': EVENT_TYPE_CHOICES,
        'selected_type': event_type,
        'search_query': search_query,
    }
    if _is_htmx(request):
        return render(request, 'dashboard/partials/workshops_list.html', context)
    return render(request, 'dashboard/workshops.html', context)


def workshops_list_view(request, year=None):
    year_param = year if year is not None else request.GET.get('year')
    selected_year = _parse_year_param(year_param)
    workshops = Workshop.objects.all().prefetch_related('images', 'videos').order_by('-featured', '-year', '-created_at', '-id')
    if selected_year is not None:
        workshops = workshops.filter(year=selected_year)
    event_type = request.GET.get('event_type') or request.GET.get('type')
    if event_type and event_type in dict(EVENT_TYPE_CHOICES):
        workshops = workshops.filter(event_type=event_type)
    else:
        event_type = None
    search_query = (request.GET.get('q') or '').strip()
    if search_query:
        workshops = workshops.filter(Q(title__icontains=search_query) | Q(description__icontains=search_query))
    years = Workshop.objects.values_list('year', flat=True).distinct().order_by('-year')
    context = {
        'workshops': workshops,
        'years': years,
        'active_year': selected_year,
        'selected_year': selected_year,
        'event_types': EVENT_TYPE_CHOICES,
        'selected_type': event_type,
        'search_query': search_query,
    }
    return render(request, 'dashboard/partials/workshops_list.html', context)


def workshop_detail_view(request, pk):
    workshop = get_object_or_404(Workshop.objects.prefetch_related('images', 'videos'), pk=pk)
    related = Workshop.objects.exclude(pk=workshop.pk).filter(event_type=workshop.event_type).prefetch_related('images')[:3]
    return render(request, 'dashboard/workshop_detail.html', {'workshop': workshop, 'related_workshops': related})


def _parse_generation_param(gen_val):
    if not gen_val:
        return None
    val_str = str(gen_val).strip().lower()
    if val_str in ('all', 'todos', 'todas', ''):
        return None
    try:
        val = int(val_str)
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def _community_members_context(request, generation=None):
    gen_param = generation if generation is not None else (request.GET.get('generation') or request.GET.get('gen'))
    selected_generation = _parse_generation_param(gen_param)
    search_query = (request.GET.get('q') or request.GET.get('search') or '').strip()
    members = CommunityMember.objects.all()
    if selected_generation is not None:
        members = members.filter(generation=selected_generation)
    if search_query:
        members = members.filter(
            Q(name__icontains=search_query)
            | Q(current_role__icontains=search_query)
            | Q(bio__icontains=search_query)
            | Q(interests__icontains=search_query)
            | Q(ask_me_about__icontains=search_query)
        )
    generations = CommunityMember.objects.values_list('generation', flat=True).distinct().order_by('-generation')
    return {
        'members': members,
        'generations': generations,
        'selected_generation': selected_generation,
        'active_generation': selected_generation,
        'search_query': search_query,
        'total_count': members.count(),
    }


def community_view(request, generation=None):
    context = _community_members_context(request, generation)
    category = request.GET.get('category') or ''
    event_year = _parse_year_param(request.GET.get('event_year'))
    events = CommunityEvent.objects.select_related('related_project', 'related_workshop').prefetch_related('media').all()
    if category in dict(COMMUNITY_CATEGORY_CHOICES):
        events = events.filter(category=category)
    else:
        category = ''
    if event_year:
        events = events.filter(event_date__year=event_year)
    context.update({
        'events': events,
        'event_categories': COMMUNITY_CATEGORY_CHOICES,
        'selected_category': category,
        'event_years': CommunityEvent.objects.exclude(event_date=None).dates('event_date', 'year', order='DESC'),
        'selected_event_year': event_year,
    })
    if _is_htmx(request):
        return render(request, 'dashboard/partials/community_list.html', context)
    return render(request, 'dashboard/community.html', context)


def community_list_view(request, generation=None):
    context = _community_members_context(request, generation)
    return render(request, 'dashboard/partials/community_list.html', context)


def community_event_detail_view(request, pk):
    event = get_object_or_404(
        CommunityEvent.objects.select_related('related_project', 'related_workshop').prefetch_related('media'),
        pk=pk,
    )
    return render(request, 'dashboard/community_event_detail.html', {'event': event})


def curriculum_view(request):
    selected_plan = _parse_year_param(request.GET.get('plan'))
    available_plans = list(Course.objects.values_list('plan_year', flat=True).distinct().order_by('-plan_year'))
    if selected_plan is None:
        selected_plan = available_plans[0] if available_plans else 2025
    courses = Course.objects.filter(plan_year=selected_plan).order_by('semester', 'id')
    search_query = (request.GET.get('q') or '').strip()
    if search_query:
        courses = courses.filter(Q(code__icontains=search_query) | Q(name__icontains=search_query) | Q(area__icontains=search_query))
    semester_groups = []
    for semester in sorted(set(courses.values_list('semester', flat=True))):
        semester_groups.append({'semester': semester, 'courses': list(courses.filter(semester=semester))})
    return render(request, 'dashboard/curriculum.html', {
        'semester_groups': semester_groups,
        'available_plans': available_plans,
        'selected_plan': selected_plan,
        'search_query': search_query,
        'course_count': courses.count(),
    })


def _group_course_resources(resources):
    type_labels = dict(COURSE_RESOURCE_CHOICES)
    grouped = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for resource in resources:
        grouped[resource.resource_type][resource.year][resource.academic_semester].append(resource)
    sections = []
    for resource_type, label in COURSE_RESOURCE_CHOICES:
        years = []
        for year in sorted(grouped[resource_type].keys(), reverse=True):
            semesters = []
            for semester in (1, 2):
                items = grouped[resource_type][year].get(semester, [])
                if items:
                    semesters.append({'number': semester, 'label': 'Primer semestre' if semester == 1 else 'Segundo semestre', 'items': items})
            if semesters:
                years.append({'year': year, 'semesters': semesters})
        sections.append({'key': resource_type, 'label': type_labels[resource_type], 'years': years})
    return sections


def course_detail_view(request, slug):
    course = get_object_or_404(Course, slug=slug)
    previous_relations = course.progression_in.select_related('from_course').all()
    next_relations = course.progression_out.select_related('to_course').all()
    resources = course.resources.all()
    reviews = course.reviews.filter(approved=True)
    averages = reviews.aggregate(
        difficulty=Avg('difficulty'),
        workload=Avg('workload'),
        usefulness=Avg('usefulness'),
        weekly_hours=Avg('weekly_hours'),
    )
    rating_percentages = {
        key: round((averages.get(key) or 0) * 20, 1)
        for key in ('difficulty', 'workload', 'usefulness')
    }
    return render(request, 'dashboard/course_detail.html', {
        'course': course,
        'previous_relations': previous_relations,
        'next_relations': next_relations,
        'resource_sections': _group_course_resources(resources),
        'reviews': reviews,
        'review_count': reviews.count(),
        'averages': averages,
        'rating_percentages': rating_percentages,
        'review_submitted': request.GET.get('opinion') == 'enviada',
    })


@require_POST
def submit_course_review(request, slug):
    course = get_object_or_404(Course, slug=slug)
    try:
        year_taken = int(request.POST.get('year_taken', ''))
        difficulty = int(request.POST.get('difficulty', ''))
        workload = int(request.POST.get('workload', ''))
        usefulness = int(request.POST.get('usefulness', ''))
        weekly_raw = (request.POST.get('weekly_hours') or '').strip()
        weekly_hours = float(weekly_raw) if weekly_raw else None
        if not (1990 <= year_taken <= 2100):
            raise ValueError
        if not all(1 <= value <= 5 for value in (difficulty, workload, usefulness)):
            raise ValueError
        if weekly_hours is not None and not (0 <= weekly_hours <= 80):
            raise ValueError
    except (TypeError, ValueError):
        messages.error(request, 'Revisa el año, las horas y las valoraciones antes de enviar.')
        return redirect('course_detail', slug=course.slug)

    experience = (request.POST.get('experience') or '').strip()
    if not experience:
        messages.error(request, 'Cuéntanos al menos brevemente cómo fue tu experiencia con el ramo.')
        return redirect('course_detail', slug=course.slug)

    CourseReview.objects.create(
        course=course,
        display_name=(request.POST.get('display_name') or '').strip()[:100],
        anonymous=request.POST.get('anonymous') == 'on',
        year_taken=year_taken,
        professor=(request.POST.get('professor') or '').strip()[:160],
        difficulty=difficulty,
        workload=workload,
        usefulness=usefulness,
        weekly_hours=weekly_hours,
        difficult_topics=(request.POST.get('difficult_topics') or '').strip(),
        advice=(request.POST.get('advice') or '').strip(),
        professor_experience=(request.POST.get('professor_experience') or '').strip(),
        prior_knowledge=(request.POST.get('prior_knowledge') or '').strip(),
        experience=experience,
        approved=False,
    )
    return redirect(f"/malla/ramo/{course.slug}/?opinion=enviada#opiniones")


def global_search_view(request):
    query = (request.GET.get('q') or '').strip()
    results = {'courses': [], 'projects': [], 'workshops': [], 'community': [], 'members': []}
    if query:
        results['courses'] = Course.objects.filter(Q(code__icontains=query) | Q(name__icontains=query) | Q(summary__icontains=query))[:8]
        results['projects'] = InitialProject.objects.filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(technologies__icontains=query)).prefetch_related('images')[:8]
        results['workshops'] = Workshop.objects.filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(organizations__icontains=query)).prefetch_related('images')[:8]
        results['community'] = CommunityEvent.objects.filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(location__icontains=query)).prefetch_related('media')[:8]
        results['members'] = CommunityMember.objects.filter(Q(name__icontains=query) | Q(bio__icontains=query) | Q(current_role__icontains=query) | Q(interests__icontains=query))[:8]
    total = sum(len(items) for items in results.values())
    return render(request, 'dashboard/search.html', {'query': query, 'results': results, 'total': total})


LOWER_PIN_BOUND = 100000
UPPER_PIN_BOUND = 999999
EXPIRATION_SPAN_MINUTES = 15
MAX_SIZE_BYTES = 2e9
TMP_DIR = "/data/buzon/tmp"


@csrf_exempt
@require_POST
def request_pin(request):
    if request.content_type != "application/json":
        return JsonResponse({"detail": "Faltan parámetros requeridos"}, status=400)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            return JsonResponse({"detail": "Json inválido."}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Json inválido."}, status=400)
    except UnicodeDecodeError:
        return JsonResponse({"detail": "Error de codificación."}, status=400)

    email = data.get("email")
    if not email or not isinstance(email, str):
        return JsonResponse({"detail": "Json inválido."}, status=400)
    email = email.strip().lower()
    if not email.endswith("@usm.cl") and not email.endswith("@sansano.usm.cl"):
        return JsonResponse({"detail": "El correo debe pertenecer a los dominios @usm.cl o @sansano.usm.cl"}, status=400)

    pin = randrange(LOWER_PIN_BOUND, UPPER_PIN_BOUND)
    new_usm_user = USMUser(pin=pin, email=email)
    new_usm_user.save()
    mailer_name = config("EMAIL_MAILER", default="default")
    send_mail(
        "¡Repositorio Telemático!",
        f"Este es tu pin de verificación: {pin}. Tiene 15 minutos de vigencia. Úsalo en el buzón para subir archivos y solicitar su adición.",
        "josue@buzon-diftel.josnic.cl",
        [email],
        using=mailer_name,
    )
    return JsonResponse({"message": "PIN enviado correctamente. Revisa tu correo."}, status=200)


@csrf_exempt
@require_POST
def upload_file(request):
    if not request.content_type or not request.content_type.startswith("multipart/form-data"):
        return JsonResponse({"detail": "Content-Type inválido."}, status=400)

    email = request.POST.get("email", "").strip().lower()
    pin_str = request.POST.get("pin", "").strip()
    if not email or not pin_str:
        return JsonResponse({"detail": "Faltan parámetros requeridos"}, status=400)
    try:
        pin = int(pin_str)
    except ValueError:
        return JsonResponse({"detail": "Faltan parámetros requeridos"}, status=400)

    limite_tiempo = now() - timedelta(minutes=EXPIRATION_SPAN_MINUTES)
    usm_user = USMUser.objects.filter(pin=pin, email=email, checked=False, timestamp__gte=limite_tiempo).first()
    if not usm_user:
        return JsonResponse({"detail": "Código PIN incorrecto o expirado."}, status=401)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file or not uploaded_file.name:
        return JsonResponse({"detail": "Faltan parámetros requeridos"}, status=400)
    if uploaded_file.size > MAX_SIZE_BYTES:
        return JsonResponse({"detail": "Archivo demasiado grande."}, status=413)

    safe_name = sanitize_filename(uploaded_file.name) or "aporte"
    safe_email = sanitize_filename(email.replace('@', '_'))
    unique_safe_name = f"{int(time.time())}_{safe_email}_{safe_name}"
    os.makedirs(TMP_DIR, exist_ok=True)
    file_path = os.path.join(TMP_DIR, unique_safe_name)

    try:
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
    except IOError:
        return JsonResponse({"detail": "Error interno al guardar el archivo"}, status=500)

    usm_user.checked = True
    usm_user.save(update_fields=['checked'])
    return JsonResponse({"detail": "Archivo recibido correctamente. Será analizado en su momento. ¡Muchas gracias!"})


def sanitize_filename(filename):
    filename = os.path.basename(filename)
    return re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)


def list_recursos(request):
    cached_data = cache.get("recursos_list")
    if cached_data:
        return JsonResponse({"files": cached_data})

    recursos_dir = "/data/recursos"
    files_list = []
    if os.path.exists(recursos_dir) and os.path.isdir(recursos_dir):
        for root, dirs, files in os.walk(recursos_dir):
            for filename in files:
                if filename.startswith('.'):
                    continue
                filepath = os.path.join(root, filename)
                size_bytes = os.path.getsize(filepath)
                if size_bytes >= 1e9:
                    size_str = f"{size_bytes / 1e9:.2f} GB"
                elif size_bytes >= 1e6:
                    size_str = f"{size_bytes / 1e6:.2f} MB"
                elif size_bytes >= 1e3:
                    size_str = f"{size_bytes / 1e3:.2f} KB"
                else:
                    size_str = f"{size_bytes} B"
                mod_time = os.path.getmtime(filepath)
                date_str = datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d')
                rel_path = os.path.relpath(filepath, recursos_dir)
                files_list.append({
                    "name": rel_path,
                    "url": f"/recursos/{rel_path}",
                    "size": size_str,
                    "date": date_str,
                })
    files_list.sort(key=lambda x: x["date"], reverse=True)
    cache.set("recursos_list", files_list, 300)
    return JsonResponse({"files": files_list})
