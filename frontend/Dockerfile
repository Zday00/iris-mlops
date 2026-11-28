# ---- Image frontend (Nginx statique + reverse proxy vers l'API) ----
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css iris-data.js /usr/share/nginx/html/

EXPOSE 80
