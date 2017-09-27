//d3.json('/get_abstraction').header('Content-Type', 'application/json')
//                               .post(JSON.stringify({'id':1, 'embedding':'TCP_EBO', 'terms' : ['queen','king','child']}),
//                                function (error, json) { console.log(json); });

function setupUi() {
    d3.select('#updatebutton').attr('onclick', 'load()');
    d3.json('/get_ui_data', function(error, json) {
        if (error) return console.warn(error);
        d3.select('#wordselectionlist').selectAll('option')
          .data(json.wordlists).enter().append('option')
          .attr('value', d => d).html(d => d);
        $("#wordselectionlist").selectmenu("refresh");
        d3.select('#xembeddinglist').selectAll('option')
          .data(json.embeddings).enter().append('option')
          .attr('value', d => d.name).html(d => d.name);
        $("#xembeddinglist").selectmenu("refresh");
        d3.select('#yembeddinglist').selectAll('option')
          .data(json.embeddings).enter().append('option')
          .attr('value', d => d.name).html(d => d.name);
        $("#yembeddinglist").selectmenu("refresh");
    });
}
setupUi();

function load() {
    var xembedding = document.getElementById('xembeddinglist').value;
    var yembedding = document.getElementById('yembeddinglist').value;
    var xdimension = document.getElementById('xdimension1').value
                     + "-" + document.getElementById('xdimension2').value;
    var ydimension = document.getElementById('ydimension1').value
                     + "-" + document.getElementById('ydimension2').value;
    var wordlist = document.getElementById('wordselectionlist').value;
    parameters = {'xembedding' : xembedding, 'yembedding' : yembedding,
                  'xdimension' : xdimension, 'ydimension' : ydimension,
                  'wordlist' : wordlist};

    //close dialog
    $("#dialog").dialog("close");
    //remove old plot
    d3.select('#content').selectAll('*').remove();
    var spinner = new Spinner().spin(d3.select('#content').node());
    
    d3.json('/projections_get_data').header('Content-Type', 'application/json')
                        .post(JSON.stringify(parameters), createChart);
}

function createChart(error, json) {
    //remove spinner
    d3.select('#content').selectAll('*').remove();
    
    if (error) return console.warn(error);    
        
    var data = json[2];

    var margin = {top: 20, right: 15, bottom: 60, left: 60}
      , width = 960 - margin.left - margin.right
      , height = 500 - margin.top - margin.bottom;
    
    var x = d3.scaleLinear()
              .domain([d3.min(data, function(d) { return d[1]; }), d3.max(data, function(d) { return d[1]; })])
              .range([ 0, width ]);
    
    var y = d3.scaleLinear()
    	      .domain([d3.min(data, function(d) { return d[2]; }), d3.max(data, function(d) { return d[2]; })])
    	      .range([ height, 0 ]);

    var chart = d3.select('#content')
	.append('svg:svg')
	.attr('width', width + margin.right + margin.left)
	.attr('height', height + margin.top + margin.bottom)
	.attr('class', 'chart')

    var main = chart.append('g')
	.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
	.attr('width', width)
	.attr('height', height)
	.attr('class', 'main')   
        
    // draw the x axis
    var xAxis = d3.axisBottom(x);

    main.append('g')
	.attr('transform', 'translate(0,' + height + ')')
	.attr('class', 'main axis date')
	.call(xAxis);

    // draw the y axis
    var yAxis = d3.axisLeft(y);

    main.append('g')
	.attr('transform', 'translate(0,0)')
	.attr('class', 'main axis date')
	.call(yAxis);

    // Define the div for the tooltip
    var div = d3.select("body").append("div")	
        .attr("class", "tooltip")
        .style("opacity", 0);

    var g = main.append("svg:g"); 
    
    var inSet = new Set(['princess', 'prince', 'boy', 'girl']);

    var quadtree = d3.quadtree();

    //find nodes within circle.
    function search(quadtree, cx, cy, r) {
        //bounding rect of circle
        var x0 = cx - r;
        var y0 = cy - r;
        var x3 = cx + r;
        var y3 = cy + r;
        nodes = [];
        quadtree.visit(function(node, x1, y1, x2, y2) {
            if (!node.length) {
                do {
                    var d = node.data;
                    var dx = x(d[1]);
                    var dy = y(d[2]);
                    var cdist = Math.sqrt((cx-dx)*(cx-dx) + (cy-dy)*(cy-dy));
                    var selected = cdist <= r;
                    if (selected) { nodes.push(d); };
                } while (node = node.next);
            }
            return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
        });
        return nodes;
    }

    function nodeAbstractions(quadtree) {
        console.log('starting');
        quadtree.visit(function(node, x1, y1, x2, y2) {
            console.log(node.length);
            console.log(node)
            //if (!node.length) {
            //    do {
            //        var d = node.data;
            //        var dx = x(d[1]);
            //        var dy = y(d[2]);
            //        var cdist = Math.sqrt((cx-dx)*(cx-dx) + (cy-dy)*(cy-dy));
            //        var selected = cdist <= r;
            //        if (selected) { nodes.push(d); };
            //    } while (node = node.next);
            //}
            //return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
        });
        //return nodes;
    }

    var lensGroup = main.append('svg:g').attr('class', 'lens');
    var lensLabels = lensGroup.append('svg:rect').attr('fill-opacity', '0.9').style('fill', 'lightblue').attr('rx', 15).attr('ry', 15);
    var lens = lensGroup.append('svg:circle')
        .attr('cx', 1)
        .attr('cy', 1)
        .attr('r', 100)
        .attr('stroke-width', '2')
        .attr('stroke', 'blue')
        .attr('fill', 'transparent')
        .on('wheel.zoom', changeSize)
        .call(d3.drag().on('drag', dragged));
        
    function createLabels (node) {
        var terms = [];
        var cx = Number(node.getAttribute('cx'));
        var cy = Number(node.getAttribute('cy'));
        var r = Number(node.getAttribute('r'));
        terms = search(quadtree, cx, cy, r);
        lensGroup.selectAll('text').remove();
        visibleTerms = terms.slice(0,10);
        
        if (visibleTerms == 0) {
            lensLabels.attr('visibility', 'hidden');
        } else {
            var fakeText = lensGroup.append('text').text('PrUgel').attr('x', 0).attr('y', 0).attr('visibility', 'hidden');
            var textHeight = fakeText.node().getBBox().height;
            lensGroup.selectAll('text').remove();
            lensLabels.attr('visibility', 'visible');
            var termsHeight = visibleTerms.length * textHeight;
            var labelsX = Number(lens.attr('cx')) + Number(lens.attr('r'));
            var labelsY = Number(lens.attr('cy'));
            var maxWidth = 0;
            
            lensGroup.selectAll('.real').data(visibleTerms).enter().append('text').text(d => d[0])
                        .attr('x', d => labelsX + 10).attr('y', (d, i) => ((labelsY + termsHeight/2) - (i * textHeight)) )
                        .each(function(d, i) {if (this.getBBox().width > maxWidth) { maxWidth = this.getBBox().width; } } );
                        
            lensLabels.attr('height', termsHeight + 5);
            if ( (labelsX + maxWidth + 20) > chart.attr('width')) {
                console.log('blub');
                labelsX = labelsX - (2*Number(lens.attr('r')) + maxWidth + 20);
                lensGroup.selectAll('text').attr('x', function(d) { newX = Number(d3.select(this).attr('x')) - 20 - 2*Number(lens.attr('r')) - maxWidth; console.log(newX); return newX; });
            }
            lensLabels.attr('x', labelsX);
            lensLabels.attr('y', labelsY - termsHeight/2);
            lensLabels.attr('width', maxWidth + 20);
        }
    }

    function dragged(d) {
        var x = d3.event.x;
        var y = d3.event.y;
        var node = d3.select(this)
                    .attr("cx", x)
                    .attr("cy", y).node();
        var r = Number(node.getAttribute('r'));
        createLabels(node);
    }
    
    function changeSize(d) {
        var delta = 0.05 * d3.event.wheelDeltaY;
        d3.event.stopPropagation();
        var r = d3.select(this).attr('r');
        var newR = Math.max(5, Number(r) + delta);
        d3.select(this).attr('r', newR);
        createLabels(this);
    }
    
    quadtree.x(d => x(d[1])).y(d => y(d[2])).addAll(data);
    //nodeAbstractions(quadtree);
    
    g.selectAll("dots")
      .data(data)
      .enter().append("svg:circle")
          .attr("cx", function (d) { return x(d[1]); } )
          .attr("cy", function (d) { return y(d[2]); } )
          .attr("r", 3)
          .on("mouseover", function(d) {
                                var tooltipText = d[0];
                                div.transition()
                                   .duration(200)
                                   .style("opacity", .9);
                                div.html(tooltipText)
                                   .style("left", (d3.event.pageX) + "px")
                                   .style("top", (d3.event.pageY - 28) + "px");
           } )
          .on("mouseout", function(d) {
                                div.transition()
                                   .duration(500)
                                   .style("opacity", 0); } );

    // text label for the x axis
    main.append("text")             
        .attr("transform",
            "translate(" + (width/2) + " ," + 
                           (height + margin.top + 20) + ")")
        .style("text-anchor", "middle")
        .text(json[0]);

    // text label for the y axis
    main.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(json[1]);

}

$(function() {
    $(document).tooltip();
});

$("#config").click(function() { $("#dialog").dialog("open"); });
$( function() {
    $("#dialog").dialog({ width: $(window).width()*0.7, height: $(window).height()*0.8, title: "Configuration" });
} );

$( function() {
    $( ".controlgroup" ).controlgroup();
    $( ".controlgroup-vertical" ).controlgroup({
      "direction": "vertical"
    });
} );
