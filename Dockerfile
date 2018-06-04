FROM tiangolo/uwsgi-nginx-flask:python3.6-index
COPY ./requirements.txt /tmp/req.txt
RUN pip install -r /tmp/req.txt
ENV STATIC_PATH /app/static
ENV STATIC_URL /s
COPY ./app /app
COPY ./uwsgi.ini /etc/uwsgi/uwsgi.ini
COPY ./nginx_timeout.conf /etc/nginx/conf.d/nginx_timeout.conf
RUN mkdir /data
EXPOSE 80
