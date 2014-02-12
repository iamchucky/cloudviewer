GL.Mesh.Trackball = function() {
  var mesh = new GL.Mesh({triangles:false, lines:true});
  var segments = 50;
  var r = 2.5;
  var offset = mesh.vertices.length;

  var connectLines = function(mesh, offset) {
    for (var i = offset+1; i < offset+segments; ++i) {
      mesh.lines.push(i-1);
      mesh.lines.push(i);
    }
    mesh.lines.push(offset+segments-1, offset);
  };

  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(r*Math.sin(rad), r*Math.cos(rad), 0);
    mesh.vertices.push(vertex.toArray());
  }
  connectLines(mesh, offset);

  offset = mesh.vertices.length;
  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(0, r*Math.sin(rad), r*Math.cos(rad));
    mesh.vertices.push(vertex.toArray());
  }
  connectLines(mesh, offset);

  offset = mesh.vertices.length;
  for (var i = 0; i < segments; ++i) {
    var rad = (i/segments) * Math.PI * 2;
    var vertex = new GL.Vector(r*Math.sin(rad), 0, r*Math.cos(rad));
    mesh.vertices.push(vertex.toArray());
  }
  connectLines(mesh, offset);

  mesh.compile();
  return mesh;
};

var Trackball = function() {
  this.invRotation = GL.Matrix.identity();
  this.mesh = null;
  this.shader = null;
  this.init();
};

Trackball.prototype.init = function() {
  var self = this;
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
};

Trackball.prototype.render = function() {
  this.shader.draw(this.mesh, gl.LINES);
};
