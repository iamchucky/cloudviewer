var TimeChart = function(elementId) {
  this.elementId = elementId;
  this.container = document.getElementById(elementId);
  this.chart = new google.visualization.Timeline(this.container);
  this.dataTable = null;
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

TimeChart.prototype.draw = function(data, rowCount, tmax, tmin) {
  if (data && data.rows) {
    // set tmax and tmin for time profile chart
    var tmaxDate = 'Date('+utils.unixTimeToHumanDate(tmax).join(', ')+')';
    var tminDate = 'Date('+utils.unixTimeToHumanDate(tmin).join(', ')+')';
    data.rows.push({
      'c':[{'v':'extent'}, {'v':tminDate}, {'v':tmaxDate}]
    });
  }
  this.dataTable = new google.visualization.DataTable(data);
  this.options['height'] = 50+rowCount*18;
  this.chart.draw(this.dataTable, this.options);

  $('#' + this.elementId + ' > div > div > div').css('overflow-y', 'hidden');
};

TimeChart.prototype.redraw = function() {
  if (this.dataTable) {
    this.chart.draw(this.dataTable, this.options);
    $('#' + this.elementId + ' > div > div > div').css('overflow-y', 'hidden');
  }
};
