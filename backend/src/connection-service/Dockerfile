# --------------------------------=[ builder ]=------------------------------- #

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/src/connection-service/package.json backend/src/connection-service/package.json
COPY common/package.json common/package.json

RUN npm ci

COPY common ./common
COPY backend/tsconfig.base.json backend/tsconfig.json ./backend/
COPY backend/src/connection-service ./backend/src/connection-service

RUN npm run build -w common && npm run build -w backend

# --------------------------=[ serve app with node ]=------------------------ #

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY common/package.json common/package.json

# only production deps in the final image
RUN npm ci --omit=dev --workspace=backend --workspace=common

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/common/dist ./common/dist

WORKDIR /app/backend

CMD ["node", "dist/connection-service/src/main.js"]
