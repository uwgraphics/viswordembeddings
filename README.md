# viswordembeddings
viswordembeddings is a web-based application to help researchers and practitioners explore and analyze word vector embeddings.
It combines implementations of multiple interactive visualization designs that support tasks to understand embeddings.
The tasks, designs and the rationale behind them are described in a [publication](https://graphics.cs.wisc.edu/Vis/EmbVis/) presented at the [EuroVis 2018](https://www.eurovis2018.org/) conference.

## Running viswordembeddings
viswordembeddings has a back-end written in [Python](https://www.python.org), version [3.6](https://www.python.org/downloads/release/python-360/). The back-end runs a server implemented using the [flask](http://flask.pocoo.org/) library.
Processing of embeddings and vector operations are done using the [numpy](https://www.numpy.org/) and [scipy](https://scipy.org/) libraries.
The [python-sharearray](https://github.com/bshillingford/python-sharearray) library is used to make sure that only one copy of an embedding is kept in memory, even if multiple instances of the server are running.

The javascript front-end depends on [jquery](https://jquery.com/) and [jquery-ui](https://jqueryui.com/), as well as [spin.js](https://spin.js.org/) for the UI. The visualizations are implemented using [d3.js](https://d3js.org/) and [d3-legend](http://d3-legend.susielu.com/).

### Installing dependencies
The python dependencies are listed in the `requirements.txt` file, and can be installed using pip:
```
  pip install -r requirements.txt
```
At this point, there is no need to install any javascript dependencies.
They are all fetched and loaded directly from the web.

### Running the server locally
The server expects a `/data` folder, containing embeddings and additional data files.
A description of its structure and an example for download is available on the [project webpage](http://graphics.cs.wisc.edu/Vis/EmbVis/).
Once the folder has been created, the server can be started with:
```
  python app/main.py demo
```
The front-end is accessible with a browser (preferably [Google Chrome](https://www.google.com/chrome/)) at `0.0.0.0:5000`.

## Docker image
Alternatively, we provide a [docker](https://www.docker.com) image of viswordembeddings that contains all dependencies.
It can be easily set up locally, or on public server infrastructure.
The image is based on the [tiangolo/uwsgi-nginx-flask:python3.6-index](https://github.com/tiangolo/uwsgi-nginx-flask-docker) image.
It uses [uWSGI](http://projects.unbit.it/uwsgi) to run the Python back-end, and [nginx](https://www.nginx.com/) to distribute traffic between uWSGI instances.
uWSGI keeps a variable pool of workers as needed through its [cheaper subsystem](http://uwsgi-docs.readthedocs.io/en/latest/Cheaper.html).

### Installing the docker image
After installing [docker](https://www.docker.com) on your system, the image can be installed using:
```
  docker pull fheimerl/viswordembeddings
```

### Running the docker image
Before we can run the image, we have to make sure that a folder containing the embeddings to analyze exists (more information about the directory structure that viswordembedding expects is available on the [project webpage](http://graphics.cs.wisc.edu/Vis/EmbVis/)).
This folder should be mounted into the docker container as the `/data` folder.
To access the front-end, the docker container exposes port 80, which can be mapped to any local port.
During runtime, all embeddings are loaded into (shared) memory addresses.
The available shared memory (--shm-size) must therefore be set to a large enough value.
The following example for running the image uses shared memory size of 10GB, makes the front-end available at local port 8080, and mounts the local folder `/embeddings_data` as the data folder into the docker container:
```
  docker run --shm-size=10GB -p 8080:80 -v /embeddings_data/:/data/ fheimerl/viswordembeddings
```
