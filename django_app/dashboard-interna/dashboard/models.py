from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, MaxLengthValidator
from django.utils.text import slugify
from urllib.parse import urlparse, parse_qs


def _video_embed_url(url):
    """Return a privacy-friendly embed URL for supported public video hosts."""
    if not url:
        return ""
    try:
        parsed = urlparse(url.strip())
        host = parsed.netloc.lower().replace("www.", "")
        path = parsed.path.strip("/")
        if host in {"youtube.com", "m.youtube.com"}:
            if path == "watch":
                video_id = parse_qs(parsed.query).get("v", [""])[0]
            elif path.startswith("shorts/") or path.startswith("embed/"):
                video_id = path.split("/", 1)[1]
            else:
                video_id = ""
            if video_id:
                return f"https://www.youtube-nocookie.com/embed/{video_id}"
        if host == "youtu.be" and path:
            return f"https://www.youtube-nocookie.com/embed/{path.split("/")[0]}"
        if host in {"vimeo.com", "player.vimeo.com"}:
            parts = [part for part in path.split("/") if part]
            video_id = parts[-1] if parts else ""
            if video_id.isdigit():
                return f"https://player.vimeo.com/video/{video_id}"
    except (ValueError, TypeError):
        return ""
    return ""


def _direct_video_url(url):
    if not url:
        return ""
    clean = url.split("?", 1)[0].lower()
    return url if clean.endswith((".mp4", ".webm", ".ogg", ".mov")) else ""


class USMUser(models.Model):
    pin = models.IntegerField(null=False, blank=False)
    email = models.EmailField(null=False, blank=False)
    timestamp = models.DateTimeField(auto_now=False, auto_now_add=True)
    checked = models.BooleanField(default=False)


PROJECT_ORIGIN_CHOICES = [
    ('diftel', 'Realizado por DIFTEL'),
    ('student', 'Realizado por estudiantes de Telemática'),
]

STUDENT_PROJECT_TYPE_CHOICES = [
    ('course', 'Proyecto de ramo'),
    ('freshmen', 'Proyecto de mechones / primer año'),
]


class InitialProject(models.Model):
    title = models.CharField(max_length=140, verbose_name="Título del Proyecto")
    tagline = models.CharField(max_length=180, blank=True, verbose_name="Bajada / slogan")
    description = models.TextField(verbose_name="Descripción", validators=[MaxLengthValidator(3000)])
    origin = models.CharField(max_length=20, choices=PROJECT_ORIGIN_CHOICES, default='student', db_index=True, verbose_name="Origen")
    student_project_type = models.CharField(max_length=20, choices=STUDENT_PROJECT_TYPE_CHOICES, blank=True, default='freshmen', db_index=True, verbose_name="Tipo de proyecto estudiantil")
    generation = models.IntegerField(verbose_name="Generación / Año", validators=[MinValueValidator(2000), MaxValueValidator(2100)])
    project_date = models.DateField(blank=True, null=True, verbose_name="Fecha del proyecto")
    members = models.TextField(verbose_name="Integrantes", help_text="Nombres separados por comas o saltos de línea", validators=[MaxLengthValidator(1000)])
    course_code = models.CharField(max_length=30, blank=True, verbose_name="Sigla del ramo")
    course_name = models.CharField(max_length=160, blank=True, verbose_name="Ramo asociado")
    technologies = models.CharField(max_length=300, blank=True, verbose_name="Tecnologías / etiquetas", help_text="Separadas por comas")
    video_url = models.URLField(max_length=500, blank=True, verbose_name="Video principal")
    external_url = models.URLField(max_length=500, blank=True, verbose_name="Enlace externo / GitHub")
    featured = models.BooleanField(default=False, verbose_name="Destacado")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Proyecto"
        verbose_name_plural = "Proyectos"
        ordering = ['-featured', '-generation', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.generation})"

    @property
    def member_list(self):
        raw = self.members.replace('\r', '\n').replace(',', '\n')
        return [item.strip() for item in raw.split('\n') if item.strip()]

    @property
    def technology_list(self):
        return [item.strip() for item in self.technologies.split(',') if item.strip()]

    @property
    def primary_image(self):
        if not self.pk:
            return None
        images = list(self.images.all())
        return images[0] if images else None

    @property
    def main_video_embed_url(self):
        return _video_embed_url(self.video_url)

    @property
    def main_direct_video_url(self):
        return _direct_video_url(self.video_url)


class ProjectImage(models.Model):
    project = models.ForeignKey(InitialProject, on_delete=models.CASCADE, related_name='images', verbose_name="Proyecto")
    image = models.ImageField(upload_to='initial_projects/', verbose_name="Imagen")
    order = models.IntegerField(default=0, verbose_name="Orden de aparición")
    caption = models.CharField(max_length=220, blank=True, verbose_name="Leyenda")

    class Meta:
        verbose_name = "Imagen de Proyecto"
        verbose_name_plural = "Imágenes de Proyecto"
        ordering = ['order', 'id']

    def __str__(self):
        return f"Imagen {self.order} para {self.project.title}"


class ProjectVideo(models.Model):
    project = models.ForeignKey(InitialProject, on_delete=models.CASCADE, related_name='videos', verbose_name="Proyecto")
    title = models.CharField(max_length=180, blank=True, verbose_name="Título")
    url = models.URLField(max_length=500, verbose_name="URL del video")
    order = models.IntegerField(default=0, verbose_name="Orden")

    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Video de Proyecto"
        verbose_name_plural = "Videos de Proyecto"

    def __str__(self):
        return self.title or f"Video de {self.project.title}"

    @property
    def embed_url(self):
        return _video_embed_url(self.url)

    @property
    def direct_video_url(self):
        return _direct_video_url(self.url)


EVENT_TYPE_CHOICES = [
    ('taller', 'Taller'),
    ('charla', 'Charla'),
    ('conferencia', 'Conferencia'),
    ('hackathon', 'Hackathon'),
    ('otro', 'Otro'),
]


class Workshop(models.Model):
    title = models.CharField(max_length=200, verbose_name="Título del Taller")
    tagline = models.CharField(max_length=180, blank=True, verbose_name="Resumen corto / slogan")
    description = models.TextField(verbose_name="Descripción")
    year = models.IntegerField(
        verbose_name="Año de Realización",
        db_index=True,
        validators=[MinValueValidator(1990), MaxValueValidator(2100)]
    )
    event_date = models.DateField(blank=True, null=True, db_index=True, verbose_name="Fecha exacta")
    event_type = models.CharField(
        max_length=50,
        choices=EVENT_TYPE_CHOICES,
        default='taller',
        verbose_name="Tipo de Evento"
    )
    involved_people = models.TextField(blank=True, verbose_name="Personas involucradas")
    organizations = models.CharField(max_length=400, blank=True, verbose_name="Organizaciones involucradas")
    guia_url = models.URLField(max_length=500, blank=True, null=True, verbose_name="URL Guía Escrita")
    material_url = models.URLField(max_length=500, blank=True, verbose_name="Material relacionado")
    video_url = models.URLField(max_length=500, blank=True, verbose_name="Video principal")
    featured = models.BooleanField(default=False, verbose_name="Destacado")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Taller Telemático"
        verbose_name_plural = "Talleres Telemáticos"
        ordering = ['-featured', '-year', '-created_at', '-id']

    def __str__(self):
        return f"{self.title} ({self.year})"

    @property
    def primary_image(self):
        if not self.pk:
            return None
        images = list(self.images.all())
        return images[0] if images else None

    @property
    def people_list(self):
        raw = self.involved_people.replace('\r', '\n').replace(',', '\n')
        return [item.strip() for item in raw.split('\n') if item.strip()]

    @property
    def main_video_embed_url(self):
        return _video_embed_url(self.video_url)

    @property
    def main_direct_video_url(self):
        return _direct_video_url(self.video_url)


class WorkshopImage(models.Model):
    workshop = models.ForeignKey(
        Workshop,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name="Taller"
    )
    image = models.ImageField(upload_to='workshops/', verbose_name="Fotografía")
    order = models.IntegerField(default=0, verbose_name="Orden de aparición")
    caption = models.CharField(max_length=200, blank=True, verbose_name="Leyenda")

    class Meta:
        verbose_name = "Fotografía de Taller"
        verbose_name_plural = "Fotografías de Taller"
        ordering = ['order', 'id']

    def __str__(self):
        return f"Fotografía {self.order} para {self.workshop.title}"


class WorkshopVideo(models.Model):
    workshop = models.ForeignKey(Workshop, on_delete=models.CASCADE, related_name='videos',-verbose_name="Taller")
    title = models.CharField(max_length=180, blank=True, verbose_name="Título")
    url = models.URLField(max_length=500, verbose_name="URL del video")
    order = models.IntegerField(default=0, verbose_name="Orden")

    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Video de Taller"
        verbose_name_plural = "Videos de Taller"

    def __str__(self):
        return self.title or f"Video de {self.workshop.title}"

    @property
    def embed_url(self):
        return _video_embed_url(self.url)

    @property
    def direct_video_url(self):
        return _direct_video_url(self.url)


class CommunityMember(models.Model):
    name = models.CharField(max_length=200, verbose_name="Nombre Completo")
    generation = models.IntegerField(
        verbose_name="Generación / Año de Ingreso",
        db_index=True,
        validators=[MinValueValidator(1990), MaxValueValidator(2100)]
    )
    bio = models.TextField(blank=True, verbose_name="Biografía")
    current_role = models.CharField(max_length=200, blank=True, verbose_name="Rol o Cargo Actual")
    interests = models.CharField(max_length=250, blank=True, verbose_name="Áreas de interés")
    ask_me_about = models.CharField(max_length=250, blank=True, verbose_name="Puedes preguntarme sobre")
    available_to_mentor = models.BooleanField(default=False, verbose_name="Disponible para orientar estudiantes")
    linkedin_url = models.URLField(max_length=255, blank=True, verbose_name="LinkedIn")
    github_url = models.URLField(max_length=255, blank=True, verbose_name="GitHub")
    email = models.EmailField(blank=True, verbose_name="Correo de Contacto")
    profile_picture = models.ImageField(upload_to='community/profile_pics/', blank=True, null=True, verbose_name="Foto de Perfil")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Miembro de la Comunidad"
        verbose_name_plural = "Comunidad y Exalumnos"
        ordering = ['-generation', 'name', 'id']

    def __str__(self):
        return f"{self.name} ({self.generation})"


COMMUNITY_CATEGORY_CHOICES = [
    ('project', 'Proyectos'),
    ('workshop', 'Talleres y charlas'),
    ('fair', 'Ferias y muestras'),
    ('welcome', 'Bienvenidas y mechoneo'),
    ('academic', 'Vida académica'),
    ('social', 'Comunidad y vida estudiantil'),
    ('other', 'Otros recuerdos'),
]


class CommunityEvent(models.Model):
    title = models.CharField(max_length=200, verbose_name="Nombre del recuerdo / actividad")
    description = models.TextField(blank=True, verbose_name="Descripción")
    category = models.CharField(max_length=30, choices=COMMUNITY_CATEGORY_CHOICES, default='social', db_index=True, verbose_name="Categoría")
    event_date = models.DateField(blank=True, null=True, db_index=True, verbose_name="Fecha")
    location = models.CharField(max_length=180, blank=True, verbose_name="Lugar")
    people = models.TextField(blank=True, verbose_name="Personas / grupos involucrados")
    related_project = models.ForeignKey(InitialProject, blank=True, null=True, on_delete=models.SET_NULL, related_name='community_events', verbose_name="Proyecto relacionado")
    related_workshop = models.ForeignKey(Workshop, blank=True, null=True, on_delete=models.SET_NULL, related_name='community_events', verbose_name="Taller relacionado")
    featured = models.BooleanField(default=False, verbose_name="Destacado")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-featured', '-event_date', '-created_at']
        verbose_name = "Registro de Comunidad"
        verbose_name_plural = "Archivo de Comunidad"

    def __str__(self):
        return self.title

    @property
    def primary_image(self):
        if not self.pk:
            return None
        for media in self.media.all():
            if media.image:
                return media
        return None


class CommunityMedia(models.Model):
    event = models.ForeignKey(CommunityEvent, on_delete=models.CASCADE, related_name='media', verbose_name="Actividad")
    image = models.ImageField(upload_to='community/archive/', blank=True, null=True, verbose_name="Foto")
    video_url = models.URLField(max_length=500, blank=True, verbose_name="URL de video")
    caption = models.CharField(max_length=220, blank=True, verbose_name="Leyenda")
    order = models.IntegerField(default=0, verbose_name="Orden")

    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Foto / video de comunidad"
        verbose_name_plural = "Fotos y videos de comunidad"

    @property
    def embed_url(self):
        return _video_embed_url(self.video_url)

    @property
    def direct_video_url(self):
        return _direct_video_url(self.video_url)


class Course(models.Model):
    code = models.CharField(max_length=30, blank=True, db_index=True, verbose_name="Sigla")
    name = models.CharField(max_length=180, verbose_name="Nombre del ramo")
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    semester = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)], db_index=True, verbose_name="Semestre")
    plan_year = models.PositiveIntegerField(default=2025, db_index=True, verbose_name="Plan / cohorte")
    credits = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="Créditos SCT")
    area = models.CharField(max_length=100, blank=True, verbose_name="Área")
    summary = models.TextField(blank=True, verbose_name="Resumen del ramo")
    featured = models.BooleanField(default=False, verbose_name="Destacado")

    class Meta:
        ordering = ['plan_year', 'semester', 'id']
        verbose_name = "Ramo"
        verbose_name_plural = "Malla y Ramos"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f"{self.code}-{self.name}" if self.code else self.name)[:200] or 'ramo'
            candidate = base
            n = 2
            while Course.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base}-{n}"
                n += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} · {self.name}" if self.code else self.name


RELATIONSHIP_TYPE_CHOICES = [
    ('progression', 'Progresión de la malla'),
    ('prerequisite', 'Prerrequisito'),
    ('recommended', 'Recomendado antes'),
]


class CourseProgression(models.Model):
    from_course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='progression_out', verbose_name="Ramo previo")
    to_course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='progression_in', verbose_name="Ramo siguiente")
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPE_CHOICES, default='progression',-verbose_name="Tipo de relación")
    note = models.CharField(max_length=220, blank=True, verbose_name="Nota")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']
        constraints = [models.UniqueConstraint(fields=['from_course', 'to_course', 'relationship_type'], name='unique_course_progression')]
        verbose_name = "Relación entre ramos"
        verbose_name_plural = "Relaciones entre ramos"


COURSE_RESOURCE_CHOICES = [
    ('notes', 'Apuntes'),
    ('exam', 'Certámenes anteriores'),
    ('quiz', 'Controles anteriores'),
    ('study', 'Material de estudio'),
]

SEMESTER_CHOICES = [(1, 'Primer semestre'), (2, 'Segundo semestre')]


class CourseResource(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='resources',-verbose_name="Ramo")
    resource_type = models.CharField(max_length=20, choices=COURSE_RESOURCE_CHOICES, db_index=True, verbose_name="Tipo")
    title = models.CharField(max_length=200, verbose_name="Título")
    year = models.PositiveIntegerField(validators=[MinValueValidator(1990), MaxValueValidator(2100)], db_index=True, verbose_name="Año")
    academic_semester = models.PositiveSmallIntegerField(choices=SEMESTER_CHOICES, db_index=True, verbose_name="Semestre académico")
    description = models.CharField(max_length=280, blank=True, verbose_name="Descripción corta")
    file = models.FileField(upload_to='courses/resources/', blank=True, null=True, verbose_name="Archivo")
    external_url = models.URLField(max_length=500, blank=True, verbose_name="Enlace externo")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-year', '-academic_semester', 'resource_type', 'title']
        verbose_name = "Material de ramo"
        verbose_name_plural = "Materiales de ramos"

    @property
    def url(self):
        if self.file:
            try:
                return self.file.url
            except ValueError:
                pass
        return self.external_url


class CourseReview(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='reviews', verbose_name="Ramo")
    display_name = models.CharField(max_length=100, blank=True, verbose_name="Nombre")
    anonymous = models.BooleanField(default=True, verbose_name="Publicar anónimamente")
    year_taken = models.PositiveIntegerField(validators=[MinValueValidator(1990), MaxValueValidator(2100)], db_index=True, verbose_name="Año en que cursó")
    professor = models.CharField(max_length=160, blank=True, verbose_name="Profesor/a")
    difficulty = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name="Dificultad")
    workload = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name="Carga de trabajo")
    usefulness = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name="Utilidad")
    weekly_hours = models.DecimalField(max_digits=4, decimal_places=1, blank=True, null=True, validators=[MinValueValidator(0), MaxValueValidator(80)], verbose_name="Horas de estudio por semana")
    difficult_topics = models.TextField(blank=True, verbose_name="Contenidos más complejos")
    advice = models.TextField(blank=True, verbose_name="Consejos para aprobar")
    professor_experience = models.TextField(blank=True, verbose_name="Experiencia con docentes")
    prior_knowledge = models.TextField(blank=True, verbose_name="Conocimientos recomendados")
    experience = models.TextField(verbose_name="Opinion / experiencia")
    approved = models.BooleanField(default=False, db_index=True, verbose_name="Aprobada para publicación")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-year_taken', '-created_at']
        verbose_name = "Opinión de ramo"
        verbose_name_plural = "Opiniones de ramos"

    @property
    def author_label(self):
        return "Estudiante anónimo" if self.anonymous or not self.display_name else self.display_name
