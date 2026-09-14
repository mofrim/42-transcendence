# --------------------------------=[ builder ]=------------------------------- #

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/src/conn-service/package.json backend/src/conn-service/package.json
COPY ftr-common/package.json ftr-common/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY ftr-common ./ftr-common
COPY backend/tsconfig.base.json backend/tsconfig.json ./backend/
COPY backend/src/conn-service ./backend/src/conn-service

RUN npm run build -w ftr-common && npm run build -w backend/src/conn-service

# --------------------------=[ serve app with node ]=------------------------ #

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY ftr-common/package.json ftr-common/package.json

# only production deps in the final image
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --omit=dev -w backend -w ftr-common -w backend/src/conn-service

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/ftr-common/dist ./ftr-common/dist

WORKDIR /app/backend

CMD ["node", "dist/conn-service/main.js"]
