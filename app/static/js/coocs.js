function setupUi(configData) {
    //extract and sort the embedding names
    var embnames = [];
    configData.embeddings.forEach(function (d) { if (d.has_context) embnames.push(d.name); });
    embnames.sort();
    
    d3.select("#addwordbutton").on("click", function() {
        d3.select("#wordlist").append("br");
        d3.select("#wordlist").append("li").append("input").attr("type", "text");
    });
    
    d3.select("#addembeddingbutton").on("click", function() {
        d3.select("#embeddinglist").append("br");
        var newNode = d3.select("#embeddinglist").append("li").append("select").node();
        d3.select(newNode).selectAll('option')
          .data(embnames).enter()
          .append('option').attr('value', d => d).html(d => d);
        $(newNode).selectmenu();
    });
    
    //add the first drop down list
    d3.select("#addembeddingbutton").on("click")();
    d3.select("#clearwordbutton").on("click", function() {
        d3.selectAll("#wordlist > *").remove();
        d3.select("#wordlist").append("li").append("input").attr("type", "text");
    });
    
    d3.select("#clearembeddingbutton").on("click", function() {
        d3.selectAll("#embeddinglist > *").remove();
        d3.select("#addembeddingbutton").on("click")();
    });
    
    d3.selection.prototype.last = function() {
        var last = this.size() - 1;
        return d3.select(this._groups[0][last]);
    };

    d3.select('#updatebutton').on('click', update);
}

d3.json('/get_ui_data', function(error, json) {        
    if (error) return console.warn(error);
    setupUi(json);
});

function update() {
    embeddings = [];
    $("#embeddinglist > li > select").each((i,e) => (embeddings.push(e.value)));
    terms = [];
    $("#wordlist > li > input").each((i,e) => (terms.push(e.value)));
    
    //close dialog
    $("#dialog").dialog("close");
    //remove old chart and start spinner
    d3.select('#content').selectAll('*').remove();
    var spinner = new Spinner().spin(d3.select('#content').node());

    var rData = {'embeddings' : embeddings, 'terms' : terms};
    d3.json('/coocs_get_data').header('Content-Type', 'application/json')
                             .post(JSON.stringify(rData), callback);
}

//define the div for the tooltip
var div = d3.select("body").append("div")	
            .attr("class", "tooltip")
            .style("opacity", 0);

function showTooltip(weight) {
    if (d3.event == null) return;
    //rect
    var line1 = '' + weight;
    div.transition()
       .duration(200)
       .style("opacity", .9);
    div.html(line1)
       .style("left", (d3.event.pageX) + "px")
       .style("top", (d3.event.pageY - 28) + "px");
}

function hideTooltip(d) {
    div.transition()
       .duration(500)
       .style("opacity", 0);
}

function callback(error, data) {

    //remove spinner
    d3.select('#content').selectAll('*').remove();

    var embs = data[0];
    var terms = data[1];
    var cooc_terms = data[2];
    var cooc_lines = data[3];
    var num_coocs = cooc_lines[embs[0]][0].length

    //create color mappings for columns of cooc terms
    var color_scales = [];
    vals = [];
    for (var i = 0; i < cooc_terms.length; i++) {
        embs.forEach(function (emb_name) {
                cooc_lines[emb_name].forEach(function (line) {
                    vals.push(line[i][1]);
                });
        });
        color_scales.push(d3.scaleLog().domain([d3.min(vals), d3.max(vals)]).range(['white', 'blue']));
    }

    for (var i = 0; i < color_scales.length; i++) {
        color_scales[i] = color_scales[color_scales.length - 1];
    }

    var newSvg = d3.select('#content').append('svg')
                   .attr('class', 'fillline')
                   .attr('width', (num_coocs * 30) + 220)
                   .attr('height', 90 + (terms.length * ((embs.length + 1) * 30)));

    newSvg.append('g').attr('id', 'cooccurrences').selectAll('text').data(cooc_terms).enter().append('text')
          .attr('transform', (d, i) => 'translate(' + ((i*30)+80) + ', 85' + ')rotate(-45)').text(d => d);

    for (var term_i = 0; term_i < terms.length; term_i++) {
        
        term = terms[term_i];
        
        var termgroup = newSvg.append('g').attr('class', 'term: ' + term)
                              .attr('transform', 'translate(0,' + (term_i * ((embs.length + 1) * 30)) + ')');
        termgroup.append('text').attr('text-anchor', 'end')
                 .attr('transform', 'translate(63, ' + (((embs.length * 30)/2) + 90) + ')').text(term);
        for (var emb_j = 0; emb_j < embs.length; emb_j++) {
            
            emb = embs[emb_j];
            list = cooc_lines[emb][term_i];
            
            var groups = termgroup.append('g').attr('class', 'emb: ' + emb)
                                  .attr('transform', 'translate(70,' + (90 + (emb_j * 30)) + ')');
            
            groups.selectAll('rect').data(list).enter().append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 30)
                .attr('height', 30)
                .attr('rx', d => d[0] ? 0 : 15)
                .attr('ry', d => d[0] ? 0 : 15)
                .style('fill', (d, i) => color_scales[i](d[1]))
                .style('stroke', 'black')
                .on('mouseout', hideTooltip)
                .on('mouseover', function(d, i) { showTooltip(d[4] + ' - ' + cooc_terms[i] + '<br/>' + d[1]); })
                .transition().attr('x', (d, i) => (i*30)).duration(1000).delay( 250 );
                
            groups.append('text')
                  .attr('transform', 'translate(' + (5+(30*cooc_terms.length)) + ', 20)')
                  .text(emb);
        }
    }
}

function keypress(d) {
    if (d3.event.keyCode === 13) {
        this.disabled = true;
        d.term = this.value;
        d3.json('/coocs_get_data').post(JSON.stringify(d), callback);
    }
}

function click() {
    var lines = d3.select('.lines').datum();
    var newId = lines.length;
    lines.push({id : newId, term : null, text : 'term ' + (lines.length + 1) + ': '});
    var newDiv = d3.select(".lines")
                   .selectAll('div').data(lines)
                   .enter().append('div')
                   .html(function(d) { return d.text; })
                   .attr('class', 'line')
                   .attr('id', function(d) { return 'div' + d.id; });
    newDiv.append('input').attr('type', 'text').on('keypress', keypress);
    //newSvg.attr('width', 100).attr('height', 10);
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
