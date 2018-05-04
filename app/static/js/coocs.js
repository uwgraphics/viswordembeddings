requirejs.config({
  paths: {
    "jquery": "https://code.jquery.com/jquery-1.12.4",
    "jqueryui": "https://code.jquery.com/ui/1.12.1/jquery-ui",
    "spin": "https://cdnjs.cloudflare.com/ajax/libs/spin.js/2.3.2/spin.min",
    "d3": "https://d3js.org/d3.v4.min",
    "d3-legend": "https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend",
  }
});

var d3 = { };
var d3_alt = d3;

require(["d3", "jquery", "jqueryui", "spin", "d3-legend"], function(d3, $, dunno, Spinner, d3legend) {

  Object.keys(d3_alt).forEach(f => d3[f] = d3_alt[f]);

  function setupUi(configData) {
      //extract and sort the embedding names
      var embnames = [];
      configData.embeddings.forEach(function (d) { if (d.has_context) embnames.push(d.name); });
      embnames.sort();

      d3.select("#addcoocbutton").on("click", function() {
          d3.select("#cooclist").append("br");
          d3.select("#cooclist").append("li").append("input").attr("type", "text");
      });
      d3.select("#clearcoocbutton").on("click", function() {
          d3.selectAll("#cooclist > *").remove();
          d3.select("#cooclist").append("li").append("input").attr("type", "text");
      });

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
      coocs = [];
      $("#cooclist > li > input").each((i,e) => (coocs.push(e.value)));
      //filter empty strings
      coocs = coocs.filter(d => d);

      //close dialog
      $("#dialog").dialog("close");
      //remove old chart and start spinner
      d3.select('#content').selectAll('*').remove();
      var spinner = new Spinner().spin(d3.select('#content').node());

      var rData = {'embeddings' : embeddings, 'terms' : terms, 'coocs' : coocs};
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

  function callback(error, data) {

      //remove spinner
      d3.select('#content').selectAll('*').remove();

      var embs = data[0];
      var terms = data[1];
      var cooc_terms = data[2];
      var cooc_lines = data[3];
      var num_coocs = cooc_lines[embs[0]][0].length
      var embsMinMax = { };

      for (var i = 0; i < cooc_terms.length; i++) {
          embs.forEach(function(emb_name) {
              if (!(emb_name in embsMinMax)) {
                  //create new entry [min, max]
                  embsMinMax[emb_name] = [Number.MAX_VALUE, Number.MIN_VALUE];
              }
              cooc_lines[emb_name].forEach(function(line) {
                  var val = line[i][1];
                  if (val < embsMinMax[emb_name][0]) { embsMinMax[emb_name][0] = val; }
                  if (val > embsMinMax[emb_name][1]) { embsMinMax[emb_name][1] = val; }
              });
          });
      }

      var embColor = { };

      //[/*'#fcfbfd', '#efedf5',*/ '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
      var brewerScales = [
          [/*'#f7fbff', '#deebf7',*/ '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  //        [/*'#f7fcf5', '#e5f5e0',*/ '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
          [/*'#fff5eb', '#fee6ce',*/ '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704']];

      for (var i = 0; i < embs.length; i++) {
          var emb_name = embs[i];
          embColor[emb_name] = linearColorScale(embsMinMax[emb_name][0], embsMinMax[emb_name][1], brewerScales[i % 2]);
      }

      var newSvg = d3.select('#content').append('svg')
                     .attr('class', 'fillline')
                     .attr('width', (num_coocs * 30) + 350)
                     .attr('height', 90 + (terms.length * ((embs.length + 1) * 30)));

      newSvg.append('g').attr('id', 'cooccurrences').selectAll('text').data(cooc_terms).enter().append('text')
            .attr('transform', (d, i) => 'translate(' + ((i*30)+80) + ', 85' + ')rotate(-45)').text(d => d);

      for (var i = 0; i < embs.length; i++) {
          var colorLegend = d3.legendColor()
              .ascending(true)
              .useClass(false)
              .scale(embColor[embs[i]])
              .shapeWidth(20)
              .shapeHeight(20);
          if (i == 0) {
            colorLegend.labels(d => d.i == 0 ? "low" : d.i == (d.genLength-1) ? "high" : "");
          } else {
            colorLegend.labels(d => null);
          }
          var ypos = parseInt(newSvg.attr("height")) / 2 - 30;
          var xpos = parseInt(newSvg.attr("width")) - 70 - (22 * i);
          newSvg.append("g")
              .attr("transform", "translate(" + xpos + "," + ypos + ")")
              .call(colorLegend);
      }

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
                  .attr('y', d => d[0] ? 0 : 5)
                  .attr('width', d => d[0] ? 30 : 20)
                  .attr('height', d => d[0] ? 30 : 20)
                  //.attr('rx', d => d[0] ? 0 : 15)
                  //.attr('ry', d => d[0] ? 0 : 15)
                  .style('fill', (d, i) => embColor[emb](d[1]))
                  .style('stroke', 'black')
                  .on('mouseout', hideTooltip)
                  .on('mouseover', function(d, i) { showTooltip(cooc_terms[i] + ' (' + d[4] +')<br/>' + d[1].toFixed(4)); })
                  .transition().attr('x', (d, i) => d[0] ? (i*30) : ((i*30)+5)).duration(1000).delay( 250 );

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
      //$("#dialog").dialog({ width: $(window).width()*0.7, height: $(window).height()*0.8, title: "Configuration" });
      $("#dialog").dialog({ width: 800, height: 500, title: "Configuration" });
  } );

  $( function() {
      $( ".controlgroup" ).controlgroup();
      $( ".controlgroup-vertical" ).controlgroup({
        "direction": "vertical"
      });
  } );

});
