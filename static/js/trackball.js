GL.Mesh.Trackball = function() {
  var mesh = new GL.Mesh({triangles:false, lines:true});
  var segments = 50;
  var r = 2.5;
  var offset = mesh.vertices.length;

  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(r*Math.sin(rad), r*Math.cos(rad), 0);
    mesh.vertices.push(vertex.toArray());
  }
  for (var i = offset+1; i < offset+segments; ++i) {
    mesh.lines.push(i-1);
    mesh.lines.push(i);
  }
  mesh.lines.push(offset+segments-1, offset);
  offset = mesh.vertices.length;
  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(0, r*Math.sin(rad), r*Math.cos(rad));
    mesh.vertices.push(vertex.toArray());
  }
  for (var i = offset+1; i < offset+segments; ++i) {
    mesh.lines.push(i-1);
    mesh.lines.push(i);
  }
  mesh.lines.push(offset+segments-1, offset);
  offset = mesh.vertices.length;
  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(r*Math.sin(rad), 0, r*Math.cos(rad));
    mesh.vertices.push(vertex.toArray());
  }
  for (var i = offset+1; i < offset+segments; ++i) {
    mesh.lines.push(i-1);
    mesh.lines.push(i);
  }
  mesh.lines.push(offset+segments-1, offset);

  mesh.compile();
  return mesh;
};

var Trackball = function() {
  this.rotation = GL.Matrix.identity();
  this.invRotation = GL.Matrix.identity();
  this.gl = null;
  this.mesh = null;
  this.shader = null;
  this.init();
};

Trackball.prototype.init = function() {
  var self = this;

  // proceed with WebGL
  var gl = GL.create({alpha: true, preserveDrawingBuffer: true, canvas: document.getElementById('trackball')});
  this.gl = gl;
  this.mesh = new GL.Mesh.Trackball();
  
  this.shader = new GL.Shader('\
    varying vec4 color;\
    void main() {\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
      if (gl_Vertex.x == 0.0) {\
        color = vec4(1.0, 0.7, 0.7, 1.0);\
      } else if (gl_Vertex.y == 0.0) {\
        color = vec4(0.7, 1.0, 0.7, 1.0);\
      } else {\
        color = vec4(0.7, 0.7, 1.0, 1.0);\
      }\
    }\
    ', '\
    varying vec4 color;\
    void main() {\
      gl_FragColor = color;\
    }\
  ');

  gl.ondraw = function() {
    //gl.clearColor(18.0/255.0, 10.0/255.0, 143.0/255.0, 1.0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.matrixMode(gl.MODELVIEW);
    gl.translate(0, 0, -10);
    gl.multMatrix(self.rotation);
    gl.multMatrix(self.invRotation);
    self.shader.draw(self.mesh, gl.LINES);
  };

  // MAIN
  gl.fullscreen({providedCanvas: true, fov: 45});
  gl.animate();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
};
