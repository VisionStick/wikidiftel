# Guía de contenidos · DIFTEL SJ

Esta guía ordena qué tipo de contenido conviene mantener en cada sección del portal.

## Criterio general

La página no recibe archivos subidos por usuarios. La información se organiza así:

- **Biblioteca del ramo:** enlace externo a una carpeta con material.
- **Experiencia Estudiantil:** opiniones, comentarios, valoraciones y consejos.
- **Proyectos, talleres y comunidad:** archivo visual/editorial de actividades relevantes.

## Proyectos

Usar esta sección para iniciativas creadas por DIFTEL o por estudiantes de Telemática. Idealmente cada proyecto debe incluir:

- título claro;
- descripción humana, no excesivamente formal;
- integrantes;
- año o generación;
- ramo asociado cuando corresponda;
- tecnologías utilizadas;
- fotos, videos o enlaces externos si existen.

## Talleres

Guardar talleres, charlas, hackathones y actividades formativas. Cada ficha puede incluir:

- nombre del taller;
- bajada o slogan corto;
- descripción completa;
- fecha y año;
- personas u organizaciones involucradas;
- enlace externo a material, guía, fotos o videos si corresponde.

## Comunidad

Usar como archivo visual y narrativo de la carrera. Sirve para recuerdos, bienvenidas, ferias, actividades académicas y momentos de vida universitaria.

## Ramos

Cada ficha de ramo puede centralizar:

- código oficial;
- nombre del ramo;
- semestre;
- área de formación;
- SCT;
- resumen breve;
- enlace a biblioteca externa cuando exista;
- opiniones de estudiantes;
- profesor/a con quien se cursó, si quien opina quiere indicarlo;
- consejos para preparar o aprobar el ramo.

## Bibliotecas externas

Los enlaces de bibliotecas se administran en:

```text
assets/ramo-biblioteca-externa.js
```

La forma recomendada de mantenerlos es:

```text
CODIGO_DEL_RAMO → enlace externo
```

Ejemplo:

```text
MAT070 → carpeta externa de MAT070
```

Si un ramo todavía no tiene enlace, la ficha debe mostrar un mensaje de “Biblioteca próximamente disponible”, sin botón roto ni enlace vacío.

## Opiniones estudiantiles

Las opiniones deben ser útiles, respetuosas y concretas. La idea no es atacar docentes ni crear un espacio de funa, sino ayudar a estudiantes nuevos a entender mejor:

- dificultad;
- carga de trabajo;
- utilidad;
- horas de estudio;
- contenidos más difíciles;
- consejos para aprobar;
- experiencia general con el ramo.

## Moderación recomendada

Cuando se conecte una base de datos real, se recomienda que las opiniones pasen por estado:

```text
pendiente → aprobada → visible
```

Así se evita spam, información falsa o comentarios irrespetuosos.
