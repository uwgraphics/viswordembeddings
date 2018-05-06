# viswordembeddings
viswordembeddings is a web-based application to help researchers and practitioners explore and analyze word vector embeddings.
It combines implementations of multiple interactive visualization designs that support important tasks to understand embeddings.
The tasks, designs and the rationale behind them are described in a [publication](https://graphics.cs.wisc.edu/Vis/EmbVis/) presented at the [EuroVis 2018](https://www.eurovis2018.org/) conference.

## Running viswordembeddings
viswordembeddings has a back-end written in [Python](https://www.python.org), version [3.6](https://www.python.org/downloads/release/python-360/). The back-end runs a server implemented using the [flask]() library.
Processing of embeddings and vector operations are done using the [numpy](https://www.numpy.org/) and [scipy](https://scipy.org/) libraries.
The [python-sharearray](https://github.com/bshillingford/python-sharearray) library is used to make sure that only one copy of an embeddings is kept in memory, even if multiple instances of the server are running.

The javascript front-end depends on [jquery](https://jquery.com/) and [jquery-ui](https://jqueryui.com/), as well as [spin.js](https://spin.js.org/) for the UI. The visualizations are implemented using [d3.js](https://d3js.org/) and [d3-legend](http://d3-legend.susielu.com/).

### Installing dependencies
The python dependencies are listed in the requirements.txt file, and can be installed using pip:
```
  pip install -r requirements.txt
```
At this point, there is no need to install any javascript dependencies.
They are all fetched and loaded directly from the web.

### Running the server locally
The server expects a `/data` folder, containing embeddings and additional data files.
A description of its structure and an example for download is available [here](http://graphics.cs.wisc.edu/Vis/EmbVis/).
Once the folder has been created, the server can be started with:
```
  python app/main.py demo
```
The front-end is then accessible with a browser (preferably [Google Chrome](https://www.google.com/chrome/)) at `0.0.0.0:5000`.

## Docker imgae
Alternatively, we provide a [docker](https://www.docker.com) container of viswordembeddings that contains all dependencies.
It can be easily set up locally, or on public server infrastructure.

### Installing the docker image
After installing [docker](https://www.docker.com) on your system, the image can be installed using:
```
  docker pull fheimerl/viswordembeddings
```

### Running the docker image
Before we can run the image, we have to make sure that a folder containing the embeddings to analyze exists (more information about the directory structure that viswordembedding expects is available [here](http://graphics.cs.wisc.edu/Vis/EmbVis/)).
This folder will be mounted into the docker container as the `/data` folder.
To access the front-end, the docker container exposes port 80, which can be mapped to any local port.
The following example for running the image uses the local port 8080 and mounts the local folder `/embeddings_data` as the data folder into the docker container:
```
  docker run fheimerl/viswordembeddings -p 8080:80 -v /embeddings_data/:/data/
```
