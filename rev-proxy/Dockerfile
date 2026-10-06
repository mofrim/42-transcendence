FROM nginx

COPY /rev-proxy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 1111
CMD ["nginx", "-g", "daemon off;"]
