Number.prototype.padLeft = function (n,str){
  return Array(n-String(this).length+1).join(str||'0')+this;
};

var cloudViewer = null;

$(function() {
  $(window).resize(function() {
    cloudViewer.glInvalidate = true;
  });

  cloudViewer = new CloudViewer();

  // proceed with WebGL
  cloudViewer.setupGL();
  cloudViewer.setupUI();
});
