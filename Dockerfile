# Step2Connect v2 — immagine unica per DEV e PROD sul server OVH (B4).
# Le variabili VITE_* vengono incorporate nella build frontend: passarle come
# build-arg (vedi deploy/docker-compose.yml). Non usare mai VITE_* per segreti.

# ── build: dipendenze complete + build Vite ──────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Su Replit il lockfile viene riscritto con il registry interno di Replit
# (package-firewall.replit.local / .internal), irraggiungibile da qui:
# lo riportiamo al registry npm pubblico. Gli hash di integrità non cambiano.
ARG NPM_LOCK_FIX='s#https?://package-firewall\.replit\.[a-z]+/npm/#https://registry.npmjs.org/#g'
RUN sed -i -E "$NPM_LOCK_FIX" package-lock.json && npm ci --no-audit --no-fund

COPY . .

ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_USER_POOL_CLIENT_ID
ARG VITE_API_BASE_URL
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID \
    VITE_COGNITO_USER_POOL_CLIENT_ID=$VITE_COGNITO_USER_POOL_CLIENT_ID \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── runtime: solo dipendenze di produzione, utente non root ──────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY package.json package-lock.json ./
ARG NPM_LOCK_FIX='s#https?://package-firewall\.replit\.[a-z]+/npm/#https://registry.npmjs.org/#g'
RUN sed -i -E "$NPM_LOCK_FIX" package-lock.json && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/SimonaDevGH/step2connect-v2" \
      org.opencontainers.image.revision=$GIT_SHA

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "server/index.js"]
