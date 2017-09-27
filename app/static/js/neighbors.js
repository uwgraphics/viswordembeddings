//"use strict";

var configData = null;

function setupUi() {
    d3.select('#addbutton').on('click', addAxis);
    d3.select('#updatebutton').on('click', update);
    d3.select('#examplebutton').on('click', example);
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
function example() {
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
    //d3.selectAll('.axisblock').select('.selectterm').attr('value', 'gay');
    //d3.selectAll('.axisblock').select('.selectembedding').each(function(d,i) {
    //    d3.select(this).selectAll('option').property('selected', d => (d.name === ((180+i)+'0') ));
    //});
}

function clearToolTips() {
    $("div[role='tooltip']").remove();
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
            .attr('title', 'Enter the term for the axis in this text box.');
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
    var data = json;
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

    var margin = {top: 20, right: 15, bottom: 60, left: 40};
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
    
    var inColor = linearColorScale(minVal, maxVal, /*['#ffffd9', ['#edf8b1',  */ ['#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58']);

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
    
    g.append('g').attr('class', 'neighborhoods').selectAll('rect')
                 .data(axisTerms).enter().append('svg:rect').attr('x', 0).attr('y', (d,i)=>(y(i)-7))
                 .attr('width', (d,i)=>(x(maxs[i]))).attr('height', 14).style('fill', '#000000').style('opacity', '0.2');
    
    var sel = g.selectAll('items').data(data).enter().filter(function(d) { return !(getSimVal(d) === 0.0); } )
    if (bars) {
       sel = sel.append('svg:rect')
                .attr('y', function (d) { return y(d[0])-6; } )
                .attr('width', 4).attr('height', 12);
    } else {
       sel = sel.append('svg:circle')
                .attr('cy', function (d) { return y(d[0]); } )
                .attr('r', 4);
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
                    return 'grey';
                }
                data_item = axisArray[d[0]+1][d[1]];
            }
            if (data_item) {
                return inColor(getSimVal(data_item));
            } else {
                return 'grey';
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
    d3.selectAll('.tick text').on('mouseover', function() { d3.select(this).style('cursor', 'pointer'); });
    
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
