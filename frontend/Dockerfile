# Build stage
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Argumento para definir a URL da API em tempo de build
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage de produção
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Backup do config do nginx opcional se precisar de SPA routing
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
