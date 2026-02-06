#!/bin/bash

# Define image names
BACKEND_IMAGE="central_afiliado_backend:latest"
FRONTEND_IMAGE="central_afiliado_frontend:latest"

echo "🔨 Iniciando build das imagens..."

# Build Backend
echo "📦 Building Backend..."
docker build -t $BACKEND_IMAGE .

# Build Frontend
# Note: VITE_API_BASE_URL should be set to the public backend URL/path.
# If using Traefik path routing or same domain, '/api' is usually fine if proxy is setup.
# In swarm with Traefik, often frontend talks to backend via public URL or relative path if same domain.
# Let's assume relative '/api' if hosted on same domain or specific URL if different.
# For now, we allow passing it as env var to the script, defaulting to '/api'
API_URL=${VITE_API_BASE_URL:-/api}

echo "🎨 Building Frontend (API_URL=$API_URL)..."
docker build --build-arg VITE_API_BASE_URL=$API_URL -t $FRONTEND_IMAGE ./frontend

echo "✅ Build concluído!"
echo "👉 Imagens criadas:"
echo "   - $BACKEND_IMAGE"
echo "   - $FRONTEND_IMAGE"
echo ""
echo "🚀 Agora você pode fazer o deploy da stack no Portainer."
