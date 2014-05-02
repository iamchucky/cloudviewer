Number.prototype.padLeft = function (n,str){
  return Array(n-String(this).length+1).join(str||'0')+this;
};

var cloudViewer = null;

$(function() {
  $(window).resize(function() {
    cloudViewer.camera.aspect = window.innerWidth / window.innerHeight;
    cloudViewer.camera.updateProjectionMatrix();

    cloudViewer.renderer.setSize( window.innerWidth, window.innerHeight );
    cloudViewer.controls.handleResize();
    cloudViewer.render();
  });

  cloudViewer = new CloudViewer();

  // proceed with WebGL
  cloudViewer.setupGL();
  cloudViewer.setupUI();

  animate();
});

function animate() {
  requestAnimationFrame(animate);
  
  if (cloudViewer.glInvalidate) {
    cloudViewer.controls.update();
    cloudViewer.render();
    cloudViewer.glInvalidate = false;
  }
}

