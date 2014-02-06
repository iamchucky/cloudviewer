GL.Mesh.axisOrb = function() {
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

var axisOrbRotation = GL.Matrix.identity();
var setupAxisOrb = function() {
    document.getElementById("axis_orb").getContext("webgl", {premultipliedAlpha: false});

    // proceed with WebGL
    var gl = GL.create({preserveDrawingBuffer: true, canvas: document.getElementById('axis_orb')});
    var axisOrbMesh = new GL.Mesh.axisOrb();
    // axis orb shader
    var axisOrbShader = new GL.Shader('\
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
        gl.multMatrix(axisOrbRotation);
        renderAxisOrb();
    };
    var renderAxisOrb = function() {
      axisOrbShader.draw(axisOrbMesh, gl.LINES);
    };

    // MAIN
    gl.fullscreen({providedCanvas: true, fov: 45});
    gl.animate();
    //gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

};
