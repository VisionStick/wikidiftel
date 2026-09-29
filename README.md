# DIFTEL SJ · Portal de Telemática

Portal estudiantil para **Ingeniería Civil Telemática USM, Campus San Joaquín**. La idea no es ser una web corporativa: es reunir en un mismo lugar información útil para recorrer la carrera, mirar la malla, entrar a bibliotecas externas por ramo, conocer proyectos/talleres y leer experiencias de estudiantes.

## Estado actual

El portal público es un **sitio estático desplegado en Vercel** (ver `vercel.json`) bajo `diftel.cl`, sin build command. El frontend vive en la raíz, las secciones públicas y `assets/`; los datos comunitarios de ramos se conectan a Supabase.

La página actualmente separa claramente dos funciones:

- **Biblioteca del ramo:** acceso a carpetas externas de material mediante enlaces por código de asignatura.
- **Experiencia Estudiantil:** opiniones, comentarios, valoraciones y consejos sobre cada ramo.

Los usuarios **no suben archivos directamente a la página**. La participación estudiantil dentro del sitio se enfoca en opiniones y experiencias por ramo.

## Secciones públicas

- `/` — Inicio.
- `/malla/` — Malla curricular y acceso a fichas de ramos.
- `/ramo/` — Ficha individual de ramo, biblioteca externa y experiencia estudiantil.
- `/proyectos/` — Archivo de proyectos de DIFTEL y estudiantes.
- `/talleres/` — Talleres: CTF de Telemática y simulador interactivo de redes.
  - `/talleres/Taller_ctf.html` — CTF Telemática de 6 estaciones (archivo autocontenido, conserva su estilo propio).
  - `/talleres/diftel/` — Simulador interactivo de redes (mensajes, juego, topología).
- `/comunidad/` — Archivo comunitario y directorio.
- `/buscar/` — Página de búsqueda estática.
- `/buzon/` — Página informativa sobre el nuevo flujo de participación.

## Malla y ramos

La malla está organizada por 10 semestres e incluye códigos, nombres, áreas de formación y SCT. Las fichas de ramo muestran información base, navegación entre ramos, biblioteca externa cuando existe enlace disponible y sección de experiencia estudiantil.

Las relaciones “ramo previo / ramo siguiente” son una navegación editorial para orientar el recorrido. No reemplazan los prerrequisitos oficiales de la universidad.

## Bibliotecas externas

Los enlaces de bibliotecas están centralizados en:

```text
assets/ramo-biblioteca-externa.js
```

Para agregar una biblioteca nueva, se debe sumar el código de ramo y su URL externa en ese archivo.

## Participación estudiantil

La participación dentro de la página se realiza mediante comentarios/opiniones de cada ramo. Las fichas usan Supabase para leer y publicar opiniones compartidas y registrar reacciones; el frontend mantiene validaciones y estados de interfaz antes de enviar los datos.

## Flujo de ramas

- `main` es producción (`diftel.cl`, Vercel). `dev` puede usarse como integración cuando el equipo lo requiera.
- Los cambios se trabajan en ramas y llegan a producción mediante PR a `main`.
- Cada PR necesita la aprobación de un codeowner (`.github/CODEOWNERS`: @craulii o @ChrisPsx).
- Para cerrar un issue al mergear, poner `Closes #N` en el PR que llega a `main`.

## Criterio visual

La interfaz busca sentirse estudiantil, cálida y clara: tonos azul oscuro/cyan, tarjetas simples, navegación directa, buen contraste, responsive y detalles visuales sin sobrecargar.

## Archivos principales

- `index.html` — Inicio.
- `assets/site.js` — Interacciones generales del portal.
- `assets/site-cleanup.js` — Correcciones globales de visibilidad, favicon y limpieza de enlaces antiguos.
- `assets/malla-cursos-v4.js` — Render y comportamiento de malla y ficha base de ramo.
- `assets/supabase-courses.js` — Cliente de datos para cursos, opiniones y reacciones en Supabase.
- `assets/course-reviews-stable.js` — Interfaz comunitaria de opiniones y reacciones.
- `assets/ramo-biblioteca-externa.js` — Mapa código de ramo → biblioteca externa.
- `assets/ramo-progression-links.js` — Navegación clickeable entre ramo previo y siguiente.
- `assets/*.css` — Estilos visuales del portal.


## Arquitectura actual

La producción no depende de Django, PostgreSQL local ni Nginx. La infraestructura heredada fue retirada del repositorio para evitar mantener dos implementaciones y múltiples copias de los mismos assets. La configuración activa de despliegue está en `vercel.json`; la configuración de Supabase está separada en los archivos del frontend y en `supabase/`.
