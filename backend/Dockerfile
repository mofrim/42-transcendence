FROM node:22-alpine
WORKDIR /app

# add some stuff for debugging
# FIXME remove for prod
RUN apk update && apk upgrade && apk add --no-cache curl bash iproute2-ss;

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY common/package.json common/

RUN npm ci;
COPY backend/src ./src

EXPOSE 3000

# CMD ["tail", "-f"]
CMD ["npm", "run", "server"]
