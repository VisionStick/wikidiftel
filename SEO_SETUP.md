# Medición SEO: Search Console y Analytics

El sitio ya incluye `robots.txt`, `sitemap.xml`, canonical y metadatos sociales. La conexión con servicios de medición requiere identificadores que pertenecen al dominio/equipo y no deben inventarse en el código.

## Google Search Console

1. Crear o abrir la propiedad de dominio `diftel.cl` en Google Search Console.
2. Completar la verificación que Google indique (preferentemente DNS para cubrir todo el dominio).
3. En **Sitemaps**, enviar `https://diftel.cl/sitemap.xml`.
4. Revisar Indexación > Páginas y Rendimiento > Consultas una vez que Google procese el sitio.

## Analytics

Si el equipo decide usar GA4, crear la propiedad y el flujo web para `diftel.cl`. Recién con el ID real `G-XXXXXXXXXX` debe agregarse el script oficial. No se deja un ID ficticio en producción.

Como alternativa más liviana puede usarse Plausible u otra solución aprobada por el equipo.

## Qué registrar

Guardar la fecha de activación y comparar periódicamente impresiones, clics, CTR, consultas y páginas de entrada. Esto permite medir el efecto de las mejoras SEO sin confundir cambios de código con datos reales.
