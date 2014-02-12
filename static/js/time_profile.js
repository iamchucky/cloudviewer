var TimeProfile = function() {
  this.container = document.getElementById('time_chart');
  this.chart = new google.visualization.Timeline(this.container);
  this.dataTable = new google.visualization.DataTable();
  this.options = {};
  this.init();
};

TimeProfile.prototype.init = function() {
  var dataTable = this.dataTable;
  dataTable.addColumn({ type: 'string', id: 'PointID' });
  dataTable.addColumn({ type: 'date', id: 'Start' });
  dataTable.addColumn({ type: 'date', id: 'End' });

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

TimeProfile.prototype.appendData = function(data) {
  this.dataTable.addRows([
    [ '0',  new Date(1789, 3, 29), new Date(1797, 2, 3) ],
    [ '0',  new Date(1799, 2, 3),  new Date(1800, 2, 3) ],
    [ '0',  new Date(1801, 2, 3),  new Date(1809, 2, 3) ]]);
  this.drawChart();
};

TimeProfile.prototype.drawChart = function() {
  this.chart.draw(this.dataTable, this.options);
};
