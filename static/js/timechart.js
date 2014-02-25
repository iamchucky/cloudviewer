var TimeChart = function(elementId) {
  this.elementId = elementId;
  this.container = document.getElementById(elementId);
  this.chart = new google.visualization.Timeline(this.container);
  this.dataTable = null;
  this.tmax = 0;
  this.tmin = 0;
  this.negatives = null;
  this.positives = null;
  this.options = {
    backgroundColor: '#1a1a1a',
    height: 70,
    timeline: { 
      groupByRowLabel: true,
      singleColor: '#2fa1d6',
      showRowLabels: false,
      barLabelStyle: { fontSize: 5 },
      rowLabelStyle: { fontSize: 8, color: 'white' }
    }
  };
};

TimeChart.prototype.draw = function(data, tmax, tmin) {
  var times = data.time_intervals;
  var rowCount = data.num_rows;
  if (times && times.rows) {
    // set tmax and tmin for time profile chart
    this.tmax = tmax;
    this.tmin = tmin;
    var tmaxDate = 'Date('+utils.unixTimeToHumanDate(tmax).join(', ')+')';
    var tminDate = 'Date('+utils.unixTimeToHumanDate(tmin).join(', ')+')';
    var rows = [
      {'c':[{'v':'extent'}, {'v':tminDate}, {'v':tminDate}]},
      {'c':[{'v':'extent'}, {'v':tmaxDate}, {'v':tmaxDate}]}
    ];
    times.rows.splice(0, 0, rows[0]);
    times.rows.splice(0, 0, rows[1]);
  }
  this.dataTable = new google.visualization.DataTable(times);
  this.options['height'] = 50+rowCount*18;
  this.chart.draw(this.dataTable, this.options);

  if (data.ticks) {
    this.negatives = data.ticks.negatives;
    this.positives = data.ticks.positives;
    this.addNegativeTicks();
    this.addPositiveTicks();
  }

  $('#' + this.elementId + ' > div > div > div').css('overflow-y', 'hidden');
};

TimeChart.prototype.redraw = function() {
  if (this.dataTable) {
    this.chart.draw(this.dataTable, this.options);
    if (this.negatives || this.positives) {
      this.addNegativeTicks();
      this.addPositiveTicks();
    }

    $('#' + this.elementId + ' > div > div > div').css('overflow-y', 'hidden');
  }
};

var SVG = function(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
};

TimeChart.prototype.addNegativeTicks = function() {
  this.addTicks(this.negatives, 'red', 8.54, 17.08);
};
TimeChart.prototype.addPositiveTicks = function() {
  this.addTicks(this.positives, '#2fa1d6', 0, 8.54);
};

TimeChart.prototype.addTicks = function(data, color, moveToY, lineToY) {
  var timespan = this.tmax - this.tmin;
  var width = $('#' + this.elementId)[0].clientWidth;
  var svgG = $(SVG('g'));

  for (var i = 0; i < data.length; ++i) {
    var portion = (data[i].timestamp - this.tmin) / timespan;
    var moveToX = width * portion;
    var element = $(SVG('path'))
      .attr('d', 'M'+moveToX+','+moveToY+'L'+moveToX+','+lineToY)
      .attr('alt', data[i].camid)
      .css('stroke', color)
      .css('stroke-width', '1px')
      .css('fill-opacity', '1')
      .css('fill', 'none')
      .mouseover(function(e) {
        var camid = $(this).attr('alt');
        $('#ticks_tooltip').text(camid);
        $('#ticks_tooltip').css('left', e.clientX+'px');
        $('#ticks_tooltip').css('top', '20px');
        //console.log(camid);
      })
      .click(function(e) {
        var camid = $(this).attr('alt');
        window.open('http://flickr.com/photo.gne?id='+camid);
      });
    svgG.append(element);
  }
  $('#time_chart rect').mouseover(function() {
    $('#ticks_tooltip').css('top', '-999px');
  });
  svgG.appendTo($('#' + this.elementId + ' svg'));
};
