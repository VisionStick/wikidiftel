# DIFTEL SJ · Portal de Telemática

Portal estudiantil para **Ingeniería Civil Telemática USM, Campus San Joaquín**. La idea no es ser una web corporativa: es reunir en un mismo lugar lo que la comunidad construye, aprende y recuerda, con una interfaz cálida, simple y administrable.

Esta versión amplía la antigua Biblioteca DIFTEL sin romper su infraestructura: mantiene Django, PostgreSQL, Nginx, Docmost, el Buzón Seguro y ClamAV, pero convierte la portada y las secciones públicas en un portal completo.

## Qué incluye esta versión

- **Tres temas globales:** Cálido, Blanco y Oscuro. La preferencia queda guardada en el navegador y también funciona en el Buzón.
- **Inicio editorial:** explica rápidamente qué es Telemática, qué hace DIFTEL y enlaza a la actividad más reciente.
- **Malla y Ramos:** malla de 10 semestres, buscador, fichas individuales, relaciones explícitas de progresión, material por año/semestre y opiniones moderables.
- **Proyectos:** separación entre proyectos de DIFTEL y proyectos de estudiantes; estos últimos se clasifican como proyecto de ramo o de mechones/primer año.
- **Talleres DIFTEL:** explorador visual inspirado en carpetas/Drive, vista previa al pasar el mouse o mantener presionado, ficha completa, fotos, videos y material.
- **Comunidad:** archivo visual por actividades/categorías/fecha más un directorio de estudiantes y egresados.
- **Buscador global:** busca simultáneamente ramos, proyectos, talleres, recuerdos y personas.
- **Navegación rápida:** atajos dentro de cada ramo y búsqueda global con `Ctrl/⌘ + K` o `/`.
- **Buzón Seguro:** mantiene el flujo correo USM → PIN → subida → escaneo, pero integrado al lenguaje visual del portal.
- **Panel Django ampliado:** el contenido nuevo se puede mantener desde `/admin/` sin editar HTML.

## Malla curricular

La migración `0009_seed_curriculum.py` carga una base editorial de **10 semestres** tomando como referencia el plan publicado por el Departamento de Electrónica USM para Ingeniería Civil Telemática.

Las relaciones “ramo previo / ramo siguiente” son **relaciones editoriales administradas por DIFTEL**. Sirven para que la navegación tenga lógica, pero no deben presentarse como reemplazo de los prerrequisitos oficiales. Se pueden cambiar desde el admin en **Relaciones entre ramos**.

## Administrar contenido

En `/admin/` se pueden gestionar proyectos, talleres, archivo de comunidad, directorio, malla, recursos y opiniones de ramos.

Consulta `GUIA_CONTENIDOS.md` para el flujo editorial recomendado.

## Despliegue

```bash
cp env.example .env
./deploy.sh
```

O manualmente:

```bash
docker compose up -d --build
```

## Rutas públicas principales

- `/` — Inicio
- `/malla/` — Malla y Ramos
- `/proyectos/` — Proyectos
- `/talleres/` — Talleres DIFTEL
- `/comunidad/` — Archivo y directorio
- `/buscar/` — Buscador global
- `/buzon/` — Aportar material
- `/admin/` — Administración

## Criterio visual

La interfaz evita un estilo excesivamente corporativo: usa tipografía amable, superficies tipo papel, pequeños detalles editoriales, fotografías y contenido de la comunidad como protagonistas. Las animaciones son discretas y respetan `prefers-reduced-motion`; los controles tienen estados de foco y la navegación móvil comparte las mismas rutas del escritorio.
