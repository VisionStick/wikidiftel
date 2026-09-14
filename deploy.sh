#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "❌ Falta .env. Copia env.example a .env y completa las variables antes de desplegar."
  exit 1
fi

echo "🌱 Levantando DIFTEL SJ…"
echo "   Django aplicará migraciones y recopilará estáticos antes de iniciar Gunicorn."
docker compose up -d --build

echo "🔎 Estado de servicios:"
docker compose ps

echo "✅ Portal desplegado. Revisa los logs con: docker compose logs -f web-django nginx"
