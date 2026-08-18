FROM nginx:alpine

COPY /rev-proxy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY /rev-proxy/nginx/server-cert.pem /etc/nginx/ssl/
COPY /rev-proxy/nginx/server-key.pem /etc/nginx/ssl/
EXPOSE 1111
CMD ["nginx", "-g", "daemon off;"]
