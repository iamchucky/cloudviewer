Number.prototype.padLeft = function (n,str){
  return Array(n-String(this).length+1).join(str||'0')+this;
};

var cloudViewer = null;

$(function() {
  $('#photo_strip').css('width', $(window).width()-10+'px');

  $(window).resize(function() {
    cloudViewer.glInvalidate = true;
    cloudViewer.timeChart.redraw();
    var width = $(window).width();
    $('#photo_strip').css('width', width-10+'px');
    $('#photo_viewer > img').css('max-width', $(window).width()*0.8+'px');
    $('#photo_viewer > img').css('max-height', $(window).height()*0.8+'px');
  });

  cloudViewer = new CloudViewer();
  cloudViewer.params.dataset = $('#dataset').text();

  // proceed with WebGL
  cloudViewer.setupGL();

  cloudViewer.setupUI();
  google.setOnLoadCallback(function() {
    cloudViewer.timeChart = new TimeChart('time_chart');
  });

  // call getInfo to get everything started.
  // getInfo calls fetchCameras and then fetchParticles
  cloudViewer.getInfo();

});
