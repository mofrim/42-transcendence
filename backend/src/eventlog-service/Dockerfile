# --------------------------------=[ builder ]=------------------------------- #

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/src/eventlog-service/package.json backend/src/eventlog-service/package.json
COPY common/package.json common/package.json

RUN npm ci

COPY common ./common
COPY backend/tsconfig.base.json backend/tsconfig.json ./backend/
COPY backend/src/eventlog-service ./backend/src/eventlog-service

RUN npm run build -w common && npm run build -w backend

# --------------------------=[ serve app with node ]=------------------------ #

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY common/package.json common/package.json
COPY backend/src/eventlog-service/package.json backend/src/eventlog-service/package.json

# only production deps in the final image
RUN npm ci --omit=dev --workspace=backend --workspace=common --workspace=backend/src/eventlog-service

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/common/dist ./common/dist

CMD ["node", "backend/dist/eventlog-service/src/main.js"]
