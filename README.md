# DIFTEL SJ · Portal de Telemática

Portal estudiantil para **Ingeniería Civil Telemática USM, Campus San Joaquín**. La idea no es ser una web corporativa: es reunir en un mismo lugar información útil para recorrer la carrera, mirar la malla, entrar a bibliotecas externas por ramo, conocer proyectos/talleres y leer experiencias de estudiantes.

## Estado actual

Esta versión pública está pensada para funcionar en **GitHub Pages** como sitio estático.

También despliega directo en **Vercel** (ver `vercel.json`): importar el repo, sin build command, dominio `diftel.cl`.

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

La participación dentro de la página se realiza mediante comentarios/opiniones de cada ramo. En la versión estática actual, las opiniones pueden almacenarse en el navegador del usuario; para hacerlas compartidas entre toda la comunidad se recomienda conectar una base de datos externa como Firebase Firestore o Supabase.

## Criterio visual

La interfaz busca sentirse estudiantil, cálida y clara: tonos azul oscuro/cyan, tarjetas simples, navegación directa, buen contraste, responsive y detalles visuales sin sobrecargar.

## Archivos principales

- `index.html` — Inicio.
- `assets/site.js` — Interacciones generales, malla y fichas de ramo.
- `assets/site-cleanup.js` — Correcciones globales de visibilidad, favicon y limpieza de enlaces antiguos.
- `assets/malla-cursos-v4.js` — Render y comportamiento de malla.
- `assets/ramo-biblioteca-externa.js` — Mapa código de ramo → biblioteca externa.
- `assets/ramo-progression-links.js` — Navegación clickeable entre ramo previo y siguiente.
- `assets/*.css` — Estilos visuales del portal.

## Nota de auditoría

El repositorio conserva algunos archivos de infraestructura heredada para despliegue alternativo/local, pero la versión publicada en GitHub Pages funciona principalmente con los archivos estáticos de la raíz, carpetas públicas y `assets/`.
