var TimeProfile = function() {
  this.container = document.getElementById('time_chart');
  this.chart = new google.visualization.Timeline(this.container);
  this.dataTable = null;
  this.options = {
    backgroundColor: '#1a1a1a',
    height: 70,
    timeline: { 
      groupByRowLabel: true,
      singleColor: '#2fa1d6',
      barLabelStyle: { fontSize: 5 },
      rowLabelStyle: { fontSize: 8, color: 'white' }
    }
  };
};

TimeProfile.prototype.drawChart = function(data, rowCount) {
  this.dataTable = new google.visualization.DataTable(data);
  this.options['height'] = 50+rowCount*20;
  this.chart.draw(this.dataTable, this.options);
};

TimeProfile.prototype.redraw = function() {
  if (this.dataTable) {
    this.chart.draw(this.dataTable, this.options);
  }
};
