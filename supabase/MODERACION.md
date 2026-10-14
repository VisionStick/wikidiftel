# Moderación previa y reportes

Las personas pueden seguir comentando y reportando sin iniciar sesión. Los nuevos
comentarios se guardan como `pending` y solo aparecen en la web cuando una cuenta
administradora activa los aprueba. Los comentarios existentes conservan su estado.

## Actualizar la instalación existente

1. Abrir **Supabase → SQL Editor → New query**.
2. Copiar y ejecutar **todo `supabase/comment-moderation.sql`** de este PR.
3. Confirmar que la ejecución termina correctamente. La migración usa una transacción
   y puede repetirse. No borra comentarios ni modifica las cuentas administradoras.
4. Después, fusionar y desplegar el frontend del PR. No desplegarlo antes del SQL.
5. Entrar a `/admin-console/` con la cuenta administradora que ya estaba autorizada.

La migración necesita las tablas de la instalación anterior: `course_reviews`,
`course_review_reactions` y `admin_users`. Si falta una, detiene la actualización.
Para una instalación nueva: ejecutar `schema.sql`, `course-reviews.sql` y
`admin-console.sql`, en ese orden, con la cuenta Auth administradora existente.

## Uso de la consola

- **Comentarios** abre por defecto los pendientes. Seleccionar una fila y pulsar
  **Aprobar comentario** lo hace público.
- **Rechazar / ocultar** exige un motivo. También permite ocultar un comentario que
  antes estaba aprobado; los reportes abiertos de ese comentario se marcan revisados.
- Se puede volver a aprobar un comentario rechazado si se corrige la decisión.
- **Reportes** permite consultar el motivo y el detalle, ir al comentario,
  cerrar el reporte o descartarlo. Cerrar/descartar exige un motivo y no cambia
  por sí mismo la visibilidad del comentario.
- **Eliminar definitivamente** mantiene una copia del comentario y sus reportes
  en la auditoría privada, después de confirmar la acción.
- La ficha muestra las acciones de ese comentario que estén entre los últimos
  100 registros de auditoría. El registro completo permanece en `admin_audit_log`.

Un reporte no oculta automáticamente ningún comentario. El token del navegador
deduplica reportes repetidos de ese navegador; no identifica a una persona ni
constituye un límite contra spam de navegadores distintos.

## Permisos

- `anon` puede leer comentarios aprobados y ejecutar las RPC públicas de envío,
  reacciones y reportes. El envío fuerza `pending`.
- Ni `anon` ni `authenticated` tienen escritura directa en `course_reviews`.
  Ambos carecen de lectura/escritura directa de reportes, administradores y auditoría.
- Las RPC administrativas comprueban `auth.uid()` contra una cuenta activa en
  `admin_users` cada vez que se ejecutan.
- La transición y su auditoría ocurren en la misma transacción. Un fallo revierte
  ambas. La moderación comprueba el estado esperado para evitar decisiones sobre
  una lista desactualizada.
- La actualización no exige cuentas ni correo a estudiantes y no migra el sistema
  actual de Me gusta/No me gusta.

## Verificación

Las pruebas se ejecutan con PostgreSQL embebido (PGlite) y DOM (jsdom):

```sh
npm --prefix tests ci
npm --prefix tests test
```

Cubren permisos por rol, envío pendiente invisible, aprobación/rechazo, auditoría
atómica, reportes privados, actualización de la instalación anterior e idempotencia;
también los mensajes del formulario, conservación del borrador y cierre de sesión.
El Auth de las pruebas simula la función `auth.uid()`; no contacta Supabase ni sustituye
una comprobación de la configuración del proyecto real.

Después de instalar en Supabase, comprobar:

1. Enviar un comentario sin cuenta desde la ficha de un ramo. Debe aparecer el aviso
   de revisión y el comentario no debe verse en una ventana privada.
2. Aprobarlo en la consola y recargar la ficha pública: debe aparecer.
3. Reportarlo sin cuenta; debe aparecer en **Reportes** y continuar visible.
4. Rechazarlo con motivo y recargar la ficha: debe desaparecer. Revisar el actor,
   fecha y motivo en la consola; sus reportes abiertos deben quedar revisados.
