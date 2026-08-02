# --------------------------------=[ builder ]=------------------------------- #

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY common/package.json common/package.json

RUN npm ci

COPY common ./common
COPY frontend ./frontend

RUN npm run build -w common && npm run build -w frontend

# --------------------------=[ serve app with nginx ]=------------------------ #

FROM nginx
#:alpine

# add some stuff for debugging
# RUN apk update && apk upgrade && apk add --no-cache curl bash iproute2-ss;

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 1111
CMD ["nginx", "-g", "daemon off;"]
