# --------------------------------=[ builder ]=------------------------------- #

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci;
COPY . .
RUN npm run build;

# --------------------------=[ serve app with nginx ]=------------------------ #

FROM nginx:alpine

# add some stuff for debugging
RUN apk update && apk upgrade && apk add --no-cache curl bash iproute2-ss;

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 1111
CMD ["nginx", "-g", "daemon off;"]
