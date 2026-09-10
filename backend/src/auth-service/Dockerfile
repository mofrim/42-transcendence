# --------------------------------=[ builder ]=------------------------------- #

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/src/auth-service/package.json backend/src/auth-service/package.json
COPY backend/src/backend-utils/package.json backend/src/backend-utils/package.json
COPY ftr-common/package.json ftr-common/package.json

RUN npm ci

COPY ftr-common ./ftr-common
COPY backend/tsconfig.base.json backend/tsconfig.json ./backend/
COPY backend/src/auth-service ./backend/src/auth-service
COPY backend/src/backend-utils ./backend/src/backend-utils

RUN npm run build -w ftr-common && npm run build -w backend/src/backend-utils && npm run build -w backend

# --------------------------=[ serve app with node ]=------------------------ #

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY ftr-common/package.json ftr-common/package.json
COPY backend/src/backend-utils/package.json backend/src/backend-utils/package.json
COPY backend/src/auth-service/package.json backend/src/auth-service/package.json

# only production deps in the final image
RUN npm ci --omit=dev --workspace=backend --workspace=ftr-common --workspace=backend/src/auth-service --workspace=backend/src/backend-utils

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/ftr-common/dist ./ftr-common/dist
COPY --from=builder /app/backend/src/backend-utils/dist ./backend/src/backend-utils/dist

CMD ["node", "backend/dist/auth-service/src/main.js"]
