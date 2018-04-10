//"use strict";

var configData = null;

function setupUi() {
    d3.select('#addbutton').on('click', addAxis);
    d3.select('#updatebutton').on('click', update);
    d3.select('#examplebuttongay').on('click', exampleGay);
    d3.select('#examplebuttonbroadcast').on('click', exampleBroadcast);
    d3.json('/get_ui_data', function(error, json) {
        if (error) return console.warn(error);
        configData = json;
        //sort the embedding names alphabetically
        configData.embeddings.sort(function(a,b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
    });
}
setupUi();

//for convenience: set up 'gay' example
function exampleGay() {
    //delete all
    d3.selectAll(".axisblock").remove();
    for (var i = 180; i <= 199 ; i++) {
        addAxis();
    }
    d3.selectAll(".axisblock").each(function(d,i) {
        var seq = Number.parseInt(d3.select(this).attr("seq"));
        d3.select(this).select(".selectterm").attr("value", "gay");
        d3.select(this).select(".selectembedding").selectAll("option").property("selected", d => (d.name === ((180+seq)+'0')));
    });
}

//for convenience: set up 'broadcast' example
function exampleBroadcast() {
    //delete all
    d3.selectAll(".axisblock").remove();
    for (var i = 185; i <= 199 ; i++) {
        addAxis();
    }
    d3.selectAll(".axisblock").each(function(d,i) {
        var seq = Number.parseInt(d3.select(this).attr("seq"));
        d3.select(this).select(".selectterm").attr("value", "broadcast");
        d3.select(this).select(".selectembedding").selectAll("option").property("selected", d => (d.name === ((185+seq)+'0')));
    });
}

function clearToolTips() {
    $("div[role='tooltip']").remove();
}

function checkExists(el) {
    var term = el.value;
    var embedding = d3.select(el.parentNode)
            .select(".selectembedding").node().value;
    d3.json('/exists')
            .header('Content-Type', 'application/json')
            .post(JSON.stringify({"emb" : embedding, "term" : term}),
                function(error, isTerm) {
                    if (error) return console.warn(error);
                    if (isTerm) {
                        d3.select(el).classed("error", false);
                    } else {
                        d3.select(el).classed("error", true);
                    }
                });
}

function addAxis() {
    //get max of sequence number
    var maxseq = -1;
    var blocks = d3.selectAll('.axisblock').each(function() {
        var seq = Number.parseInt(d3.select(this).attr('seq'));
        if (seq > maxseq) {
            maxseq = seq;
        }
    });
    //send signal to backend to preload stuff
    d3.json('/neighbors_signal').header('Content-Type', 'application/json')
                        .post(JSON.stringify(requestData(final=false)), null);
    var newblock = d3.select('.defineaxes').append('li').attr('class', 'axisblock').attr('seq', (maxseq + 1));
    newblock.append('select').attr('class', 'selectembedding')
            .attr('title', 'Select embeddings for the axis.').selectAll('option')
            .data(configData.embeddings).enter().append('option').attr('value', d => d.name).html(d => d.name);
    newblock.append('input').attr('type', 'text').attr('class', 'selectterm')
            .attr('title', 'Enter the term for the axis in this text box.')
            .on('change', function() { var el = this; checkExists(el); })
            .on('click', function() { if (d3.event.altKey) {
                var thisText = d3.select(this).node().value;
                d3.selectAll('.axisblock > .selectterm')
                .each(function() { this.value = thisText; checkExists(this); });
            } });
    newblock.append('input').attr('type', 'button').attr('value', 'X').on('click',
             function() { newblock.remove(); clearToolTips(); })
            .attr('title', 'Click to remove this axis from the list.');
}

function requestData(final=true) {
    var data = [];
    var numneighbors = Number(document.getElementById('numberofneighbors').value);
    d3.selectAll('.axisblock').each(function() {
        var seq = Number.parseInt(d3.select(this).attr('seq'));
        var emb = this.getElementsByClassName('selectembedding')[0].value;
        var term = this.getElementsByClassName('selectterm')[0].value;
        //if (final) this.getElementsByClassName('selectterm')[0].disabled = true;
        data.push({'embedding' : emb, 'term' : term, 'numneighbors' : numneighbors, 'seq' : seq});
    });
    rank = d3.select('#rankswitch').property('checked');
    bars = d3.select('#bars').property('checked');
    return data;
}

var lastRequest = null;
var rank = false;
var bars = false;
function update() {
    //close dialog
    $("#dialog").dialog("close");
    //remove old chart
    d3.select('#content').selectAll('*').remove();
    var spinner = new Spinner().spin(d3.select('#content').node());
    var rData = requestData();
    rData.forEach(function(d, i) { d.id = i; });
    lastRequest = rData;
    d3.json('/neighbors_get_data').header('Content-Type', 'application/json')
                                 .post(JSON.stringify(rData), plotBuddies);
}

function linearColorScale(val1, val2, colors) {
    var numSteps = colors.length - 1;
    var domainStepSize = (val2 - val1) / numSteps;
    var domain = [];
    for (var i = 0; i < numSteps; i++) {
        domain.push(val1 + (domainStepSize * i));
    }
    domain.push(val2);
    return d3.scaleLinear().domain(domain).range(colors);
}

function getSimVal(d) {
    if (rank) {
        return d[4];//rank
    } else {
        return 1.0-d[2];//cosine
    }
}

function plotBuddies(error, json) {
    //remove spinner
    d3.select('#content').selectAll('*').remove();
    //handle buddy plots
    if (error) return console.warn(error);
    var data = json["neighbors"];
    idArray = [];
    axisTerms = [];
    lastRequest.sort((a,b)=>(a.seq - b.seq));
    lastRequest.forEach( function(d, i) { axisTerms.push(d.embedding); idArray.push(i); } );
    axisArray = [];
    axisTerms.forEach( function(d) { axisArray.push( { } ); } );
    mins = [];
    maxs = [];
    for (var i = 0; i < axisTerms.length; i++) {
        mins.push(Infinity);
        maxs.push(0.0);
    }
    data.forEach(function(d, i) {
        var pos = d[0];
        axisArray[pos][d[1]] = d;

        if (d[3]) { //is nearest neighbor?
            var val = getSimVal(d);
            if (mins[pos] > val) {
                mins[pos] = val;
            }
            if (maxs[pos] < val) {
                maxs[pos] = val;
            }
        }
    });

    // get width of div containing the svg
    divWidth = d3.select('#content').node().offsetWidth;

    var margin = {top: 20, right: 15, bottom: 60, left: 100};
    var width = divWidth - margin.left - margin.right - 20;
    var height = (axisTerms.length * 30) + margin.top + margin.bottom + 40;

    var minVal = d3.min(data, function(d) {return getSimVal(d)});
    var maxVal = d3.max(data, function(d) {return getSimVal(d)});

    var x = d3.scaleLinear()
              .domain([ minVal , maxVal ]) //data contains cosine similarity
              .range([ 0, width ]);

    var y = d3.scalePoint()
              .domain(idArray)
              .range([ 40, (axisTerms.length * 30) + 40 ]);

    var chart = d3.select('#content')
                  .append('svg:svg')
                  .attr('width', width + margin.left + margin.right)
                  .attr('height', height)
                  .attr('class', 'chart');

    var main = chart.append('g')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                    .attr('width', width)
                    .attr('height', height)
                    .attr('class', 'main');

    //line function
    var lineFunction = d3.line()
                         .x(function(d) { return x(getSimVal(d)); })
                         .y(function(d) { return y(d[0]); });

    //create the y axis
    var yAxis = d3.axisLeft(y)
                  .tickSize(-width, 0)
                  .tickFormat(i => axisTerms[i]);

    //group for lines
    var lines = main.append('g').attr('id', 'lines');

    main.append('g')
        .attr('transform', 'translate(0,0)')
        .attr('class', 'axis')
        .call(yAxis);
    d3.selectAll('.tick').data(lastRequest);

    // Define the div for the tooltip
    var div = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);

    var inColor = linearColorScale(minVal, maxVal,/*['#ffffd9', ['#edf8b1',*/ ['#c7e9b4','#c7e9b4','#c7e9b4','#c7e9b4','#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58']);
    //var inColor = linearColorScale(minVal, maxVal, ['#d7191c', '#d7191c',  /*'#fdae61', '#ffffbf', '#abd9e9',*/ '#2c7bb6', '#2c7bb6']);

    // define color gradient in svg to draw legend later
    var defs = chart.append('defs').append('linearGradient').attr('id', 'colorgradient')
                    .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%')
                    .selectAll('stop').data(inColor.range()).enter().append('stop')
                    .attr('offset', function(d,i) { return i / (inColor.range().length - 1); })
                    .attr('stop-color', function(d) { return d; });

    var g = main.append('svg:g');

    var selection = false;

    // add color legend
    g.append('rect').attr('id', 'legend').attr('x', 0).attr('y', 0).attr('height', 20)
                    .attr('width', width).attr('fill', 'url(#colorgradient)');

    var neighborPaddings = g.append('g').attr('class', 'neighborhoods').selectAll('rect')
                            .data(axisTerms).enter().append('g');
    neighborPaddings.append('svg:rect').attr('x', 0).attr('y', (d,i)=>(y(i)-7))
                    .attr('width', (d,i)=>(x(maxs[i]))).attr('height', 14)
                    .style('fill', '#000000').style('opacity', '0.2')
                    .on('mouseover', ()=>(d3.selectAll('.quartiles').style('opacity', '1')))
                    .on('mouseout', ()=>(d3.selectAll('.quartiles').style('opacity', '0')));

    neighborPaddings = neighborPaddings.append('g').attr('class', 'quartiles').style('opacity', '0');
    neighborPaddings.append('svg:rect').attr('x', (d,i)=>(x(maxs[i])-2)).attr('y', (d,i)=>(y(i)-10))
                    .attr('width', 2).attr('height', 10);
    neighborPaddings.append('text').attr('x', (d,i)=>(x(maxs[i])-20))
                    .attr('y', (d,i)=>(y(i)-12))
                    .text(function(d, i) {
                        var nsize = maxs[i];
                        var quartiles = json['stats'][d];
                        if (quartiles) {
                            //do we have information about the quartiles?
                            if (nsize <= quartiles[0]) {
                                return '<=Q1';
                            } else if (nsize <= quartiles[1]) {
                                return '<=Q2';
                            } else if (nsize <= quartiles[2]) {
                                return '<=Q3';
                            } else {
                                return '>Q3';
                            }
                        }
                    });
    //g.append('g').selectAll('rect').data(axisTerms).enter().append('g')
    //             .append('svg:rect').attr('x', (d,i)=>(x(maxs[i])-2)).attr('y', (d,i)=>(y(i)-10))
    //             .attr('width', 2).attr('height', 20);

    var sel = g.selectAll('items').data(data).enter().filter(function(d) { return !(getSimVal(d) === 0.0); } )
    if (bars) {
       sel = sel.append('svg:rect')
                .attr('y', function (d) { return y(d[0])-6; } )
                .attr('width', 4).attr('height', 12);
    } else {
       sel = sel.append('svg:circle')
                .attr('cy', function (d) { return y(d[0]); } )
                .attr('r', 5);
    }

    sel.attr('class', function(d) { if (d[3]) { return 'items nn'; } else { return 'items fn'; } ;} )
       .on('mouseover', function(d) {
                            if (d3.select(this).attr('active') === 'false') { return; };
                            var line1 = d[1];
                            var line2 = getSimVal(d);
                            var tooltipText = line1 + '<br/>' + line2;
                            div.transition()
                               .duration(200)
                               .style('opacity', .9);
                            div.html(tooltipText)
                               .style('left', (d3.event.pageX) + 'px')
                               .style('top', (d3.event.pageY - 28) + 'px'); } )
       .on('mouseout', function(d) {
                            div.transition()
                               .duration(500)
                               .style('opacity', 0); } )
       .on('click', function(d) {
                            if (selection) {
                                g.selectAll('.items').attr('opacity', 1).attr('active', 'true');
                                selection = false;
                                lines.selectAll('#temppath').remove();
                            } else {
                                var opacity = d3.event.ctrlKey ? 0 : 1;
                                termData = [];
                                g.selectAll('.items').filter(d2 => !(d2[1] === d[1]))
                                                     .attr('opacity', opacity)
                                                     .attr('active', 'false');
                                g.selectAll('.items').filter(d2 => ((d2[1] === d[1]) && (!(d2[2] === 0.0))))
                                                     .each(function(d) { termData.push(d); });
                                termData.sort((a,b) => (y(a[0])-y(b[0])));
                                selection = true;
                                //add path
                                lines.append('path').attr('d', lineFunction(termData))
                                                    .attr('stroke', 'black')
                                                    .attr('stroke-width', 1)
                                                    .attr('fill', 'none')
                                                    .attr('id', 'temppath');
                            }
    } )

    var colorItems = function(reference) {
        sel.attr('fill', function (d) {
            var data_item = null;
            if (reference != null) {
                data_item = axisArray[reference][d[1]];
            } else {
                if ((d[0] + 1) === axisTerms.length) {
                    //last axis?
                    return 'black';
                }
                data_item = axisArray[d[0]+1][d[1]];
            }
            if (data_item) {
                return inColor(getSimVal(data_item));
            } else {
                return 'black';
            }
        } )
    }
    colorItems();

    var selectedTickTextNode = null;
    d3.selectAll('.tick text').on('click', function() {
        if (selectedTickTextNode) {
            d3.select(selectedTickTextNode).classed('selected', false);
        }
        if (selectedTickTextNode === this) {
            selectedTickTextNode = null;
            colorItems();
        } else {
            selectedTickTextNode = this;
            d3.select(selectedTickTextNode).classed('selected', true);
            var selection = d3.select(selectedTickTextNode.parentNode).data()[0];
            colorItems(selection.id);
        }
    });
    d3.selectAll('.tick text').on('mouseover', function(i) {
        d3.select(this).style('cursor', 'pointer');
        var yPos = d3.select(this).node().parentNode.getBoundingClientRect().y +
            d3.select(this).node().parentNode.getBoundingClientRect().height;
        var xPos = d3.select(this).node().parentNode.getBoundingClientRect().x;
        var width = d3.select(this).node().parentNode.getBoundingClientRect().width;
        div.selectAll("*").remove();
        div.html(null);
        var termsGroup = div.append("svg").attr("id", "axisTerms")
            .style("width", "100%")
            .style("height", "100%");
            //.append("rect")
            //.attr("width", "100%")
            //.attr("height", "100%")
            //.style("fill", "red");
        div.style('left', xPos + 'px')
           .style('top', yPos + 'px')
           .style('width', (width + 10) + 'px');
           //.style('height', '300px');
        div.transition()
          .duration(200)
          .style('opacity', 1.0);
        var maxWidth = 0;
        d3.selectAll(".items").filter(d => d[0] == i).each(function(d) {
          var thisNode = d3.select(this);
          var thisXPos = this.getBoundingClientRect().x - xPos;
          var thisYPos = this.getBoundingClientRect().y - yPos;
          var thisWidth = this.getBoundingClientRect().width;
          var thisHeight = this.getBoundingClientRect().height;
          var newNode = termsGroup.append("text")
            //.attr("transform", "rotate(-70," + (x(getSimVal(d))) + "," + (y(d[0]) + 100) + ")")
            .attr("transform", "rotate(-90," + thisXPos + "," + thisYPos + ")")
            .text(d[1])
            //.attr("y", () => y(d[0]) + 100)
            .attr("y", thisYPos)
            //.attr("x", () => x(getSimVal(d)));
            .attr("x", thisXPos);
          var newNodeWidth = newNode.node().getBBox().width;
          var newNodeHeight = newNode.node().getBBox().height/2.0;
          newNode.attr("y", thisYPos + newNodeWidth + 30)
                  .attr("x", thisXPos + newNodeHeight)
                  .attr("transform", "rotate(-90," + (thisXPos + newNodeHeight) + "," + (thisYPos + newNodeWidth + 30) + ")");
                  //.attr("x", thisXPos)
                  //.attr("transform", "rotate(-90," + (thisXPos) + "," + (thisYPos + newNodeWidth + 10) + ")");
          if (newNodeWidth > maxWidth) {
            maxWidth = newNodeWidth;
          }
        });
        div.style("height", maxWidth + 20 + "px");
        //avoid collisions
        var collisions = 1;
        while (collisions) {
          collisions = 0;
          var lastNode = null;
          termsGroup.selectAll("text").each(function(d) {
            var thisNode = d3.select(this);
            if (!lastNode) {
              lastNode = thisNode;
            } else {
              var lastPos = lastNode.node().getBoundingClientRect().x + lastNode.node().getBoundingClientRect().width;
              var thisPos = thisNode.node().getBoundingClientRect().x;
              var delta = 2;
              //if collision
              if (thisPos - lastPos < 2) {
                console.log("COLLISION", lastNode.html(), thisNode.html());
                collisions++;
                var lastX = parseInt(lastNode.attr("x"));
                var lastY = parseInt(lastNode.attr("y"));
                var thisX = parseInt(thisNode.attr("x"));
                var thisY = parseInt(thisNode.attr("y"));

                lastNode.attr("x", lastX - delta);
                thisNode.attr("x", thisX + delta);
                lastNode.attr("transform", "rotate(-90," + (lastX - delta) + "," + lastY + ")");
                thisNode.attr("transform", "rotate(-90," + (thisX + delta) + "," + thisY + ")");
              }
              lastNode = thisNode;
            }
          });
        }
    }).on('mouseout', function(i) {
        d3.select(this).style('cursor', 'default');
        div.transition().duration(500).style('opacity', 0).on("end", function() {
          div.selectAll("svg").remove();
          div.style("width", null);
          div.style("height", null);
        });
    }).each(function(d,i) {
        var textNode = this;
        var x = +d3.select(textNode).attr("x");
        d3.select(textNode).attr("x", x - 3);
        d3.select(textNode.parentNode).append("text").text(()=>(lastRequest[i]['term'])).attr("x", x - 3).attr("dy", "1.5em").style("fill", "#000");
    });

    if (bars) {
       sel.transition().attr('x', (d) => (x(getSimVal(d))-2)).duration(1000).delay(50);
    } else {
       sel.transition().attr('cx', function (d) { return x(getSimVal(d)); } ).duration(1000).delay(50);
    }

}


$("#config").click(function() { $("#dialog").dialog("open"); });
$( function() {
    $("#dialog").dialog({ width: $(window).width()*0.7, height: $(window).height()*0.8, title: "Configuration" });
} );

$(function() {
    $(document).tooltip();
});

$( function() {
    $( ".controlgroup" ).controlgroup({
      "direction": "vertical"
    });
} );
