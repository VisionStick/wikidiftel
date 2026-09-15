from django.contrib import admin
from .models import (
    USMUser,
    InitialProject,
    ProjectImage,
    ProjectVideo,
    Workshop,
    WorkshopImage,
    WorkshopVideo,
    CommunityMember,
    CommunityEvent,
    CommunityMedia,
    Course,
    CourseProgression,
    CourseResource,
    CourseReview,
)

admin.site.site_header = "DIFTEL SJ · Administración"
admin.site.site_title = "DIFTEL SJ"
admin.site.index_title = "Contenido del portal"
admin.site.register(USMUser)


class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 1
    fields = ('image', 'order', 'caption')
    ordering = ('order',)


class ProjectVideoInline(admin.TabularInline):
    model = ProjectVideo
    extra = 0
    fields = ('title', 'url', 'order')
    ordering = ('order',)


@admin.register(InitialProject)
class InitialProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'origin', 'student_project_type', 'generation', 'course_code', 'featured', 'created_at')
    list_filter = ('origin', 'student_project_type', 'generation', 'featured')
    search_fields = ('title', 'members', 'description', 'course_code', 'course_name', 'technologies')
    inlines = [ProjectImageInline, ProjectVideoInline]


class WorkshopImageInline(admin.TabularInline):
    model = WorkshopImage
    extra = 1
    fields = ('image', 'order', 'caption')
    ordering = ('order',)


class WorkshopVideoInline(admin.TabularInline):
    model = WorkshopVideo
    extra = 0
    fields = ('title', 'url', 'order')
    ordering = ('order',)


@admin.register(Workshop)
class WorkshopAdmin(admin.ModelAdmin):
    # Se mantienen estos atributos por compatibilidad con los tests originales.
    list_display = ('title', 'year', 'event_type', 'guia_url', 'created_at')
    list_filter = ('year', 'event_type')
    search_fields = ('title', 'description', 'guia_url')
    inlines = [WorkshopImageInline, WorkshopVideoInline]


@admin.register(WorkshopVideo)
class WorkshopVideoAdmin(admin.ModelAdmin):
    list_display = ('workshop', 'title', 'order')
    search_fields = ('workshop__title', 'title', 'url')


@admin.register(CommunityMember)
class CommunityMemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'generation', 'current_role', 'email')
    list_filter = ('generation',)
    search_fields = ('name', 'bio', 'current_role', 'email')


class CommunityMediaInline(admin.TabularInline):
    model = CommunityMedia
    extra = 1
    fields = ('image', 'video_url', 'caption', 'order')
    ordering = ('order',)


@admin.register(CommunityEvent)
class CommunityEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'event_date', 'location', 'featured')
    list_filter = ('category', 'featured', 'event_date')
    search_fields = ('title', 'description', 'location', 'people')
    inlines = [CommunityMediaInline]


class CourseProgressionOutgoingInline(admin.TabularInline):
    model = CourseProgression
    fk_name = 'from_course'
    extra = 1
    verbose_name = 'Ramo siguiente / relación'
    verbose_name_plural = 'Progresión desde este ramo'


class CourseResourceInline(admin.TabularInline):
    model = CourseResource
    extra = 0
    fields = ('resource_type', 'title', 'year', 'academic_semester', 'file', 'external_url')


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'semester', 'plan_year', 'area')
    list_filter = ('plan_year', 'semester', 'area')
    search_fields = ('code', 'name', 'summary', 'area')
    prepopulated_fields = {}
    inlines = [CourseProgressionOutgoingInline, CourseResourceInline]


@admin.register(CourseProgression)
class CourseProgressionAdmin(admin.ModelAdmin):
    list_display = ('from_course', 'to_course', 'relationship_type', 'order')
    list_filter = ('relationship_type',)
    search_fields = ('from_course__name', 'from_course__code', 'to_course__name', 'to_course__code')


@admin.register(CourseReview)
class CourseReviewAdmin(admin.ModelAdmin):
    list_display = ('course', 'author_label_admin', 'year_taken', 'difficulty', 'workload', 'usefulness', 'approved', 'created_at')
    list_filter = ('approved', 'year_taken', 'difficulty', 'workload', 'usefulness')
    search_fields = ('course__name', 'course__code', 'display_name', 'professor', 'experience', 'advice')
    actions = ['approve_reviews']

    @admin.display(description='Autor/a')
    def author_label_admin(self, obj):
        return obj.author_label

    @admin.action(description='Aprobar opiniones seleccionadas')
    def approve_reviews(self, request, queryset):
        queryset.update(approved=True)
