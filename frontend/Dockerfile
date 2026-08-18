FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY common/package.json common/package.json

RUN npm ci

COPY common ./common
COPY frontend ./frontend

RUN npm run build -w common && npm run build -w frontend;

ARG USER_ID=1000
ARG GROUP_ID=1000
RUN  groupadd -f -g $GROUP_ID appuser && \
    (grep ":$USER_ID:" /etc/passwd || useradd -u $USER_ID -g appuser -M) &&  \
    mkdir -p /dist && \
    chown $USER_ID:$GROUP_ID /dist

ENTRYPOINT rm -rf /dist/* && cp -r /app/frontend/dist/* /dist && chown -R $USER_ID:$GROUP_ID /dist && ls -al /dist
