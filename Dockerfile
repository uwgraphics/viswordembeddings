FROM tiangolo/uwsgi-nginx-flask:python3.6-index
RUN apt-get update && apt-get install unzip
COPY ./requirements.txt /tmp/req.txt
RUN pip install -r /tmp/req.txt
ENV STATIC_PATH /app/static
COPY ./app /app
RUN mkdir /data
RUN curl -o /tmp/c.zip https://brand.wisc.edu/content/uploads/2016/11/uw-crest-web.zip \
    && unzip -p /tmp/c.zip  uw-crest-web.svg > /app/static/crest.svg
RUN rm /tmp/*
