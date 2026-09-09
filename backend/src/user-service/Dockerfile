# --------------------------------=[ builder ]=------------------------------- #

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/src/user-service/package.json backend/src/user-service/package.json
COPY ftr-common/package.json ftr-common/package.json

RUN npm ci

COPY ftr-common ./ftr-common
COPY backend/tsconfig.base.json backend/tsconfig.json ./backend/
COPY backend/src/user-service ./backend/src/user-service

RUN npm run build -w ftr-common && npm run build -w backend/src/user-service

# --------------------------=[ serve app with node ]=------------------------ #

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY ftr-common/package.json ftr-common/package.json
COPY backend/src/user-service/package.json backend/src/user-service/package.json

# only production deps in the final image
RUN npm ci --omit=dev --workspace=backend --workspace=ftr-common --workspace=backend/src/user-service

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/ftr-common/dist ./ftr-common/dist

CMD ["node", "backend/dist/user-service/src/main.js"]
