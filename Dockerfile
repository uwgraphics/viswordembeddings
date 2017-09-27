FROM tiangolo/uwsgi-nginx-flask:python3.6-index
COPY ./requirements.txt /tmp/req.txt
RUN pip install -r /tmp/req.txt
ENV STATIC_PATH /app/static
COPY ./app /app
RUN mkdir /data
