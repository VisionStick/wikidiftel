from dashboard import views
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from django.contrib import admin
from decouple import config

urlpatterns = [
    path("", views.landing_view, name="landing"),
    path(config('ADMIN_URL', default='admin/').strip('/') + '/', admin.site.urls),
    path("buscar/", views.global_search_view, name="global_search"),
    path("buzon/", views.buzon_page_view, name="buzon_page"),
    path("buzon/api/request-pin", views.request_pin),
    path("buzon/api/upload", views.upload_file),
    path("buzon/api/recursos", views.list_recursos),
    path("proyectos/", views.initial_projects_view, name="initial_projects"),
    path("proyectos-iniciales/", views.initial_projects_view, name="legacy_initial_projects"),
    path("proyectos-iniciales/generacion/<int:generation>/", views.initial_projects_list_view, name="initial_projects_list"),
    path("proyectos/<int:pk>/", views.project_detail_view, name="project_detail"),
    path("talleres/", views.workshops_view, name="workshops"),
    path("talleres/year/<int:year>/", views.workshops_view, name="workshops_by_year"),
    path("talleres/partial/", views.workshops_list_view, name="workshops_list"),
    path("talleres/partial/year/<int:year>/", views.workshops_list_view, name="workshops_list_by_year"),
    path("talleres/<int:pk>/", views.workshop_detail_view, name="workshop_detail"),
    path("comunidad/", views.community_view, name="community"),
    path("comunidad/generacion/<int:generation>/", views.community_view, name="community_by_generation"),
    path("comunidad/search/", views.community_list_view, name="community_search"),
    path("comunidad/partial/", views.community_list_view, name="community_list"),
    path("comunidad/partial/generacion/<int:generation>/", views.community_list_view, name="community_list_by_generation"),
    path("comunidad/recuerdo/<int:pk>/", views.community_event_detail_view, name="community_event_detail"),
    path("malla/", views.curriculum_view, name="curriculum"),
    path("malla/ramo/<slug:slug>/", views.course_detail_view, name="course_detail"),
    path("malla/ramo/<slug:slug>/opinar/", views.submit_course_review, name="submit_course_review"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
