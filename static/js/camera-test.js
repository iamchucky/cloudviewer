$(function() {

    // proceed with WebGL
    var gl = GL.create({preserveDrawingBuffer: true, canvas: document.getElementById('canvas')});
    var angleX = 0;
    var angleY = 0;

    var Parameters = function() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.lookAtX = 1;
        this.lookAtY = 0;
        this.lookAtZ = 0;
        this.upX = 0;
        this.upY = 0;
        this.upZ = 1;
        this.fov = 20;
    };
    var params = new Parameters();
    // define the DAT.GUI
    var gui = new dat.GUI();
    gui.add(params, 'x', -5.0, 5.0).onChange(function() { update(); });
    gui.add(params, 'y', -5.0, 5.0).onChange(function() { update(); });
    gui.add(params, 'z', -5.0, 5.0).onChange(function() { update(); });
    gui.add(params, 'lookAtX', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'lookAtY', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'lookAtZ', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'upX', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'upY', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'upZ', 0.0, 1.0).onChange(function() { update(); });
    gui.add(params, 'fov', 0.0, 90.0).onChange(function() { update(); });

    var camera;
    var update = function() {
        var pos = new GL.Vector(params.x, params.y, params.z);
        var lookat = new GL.Vector(params.lookAtX, params.lookAtY, params.lookAtZ);
        var up = new GL.Vector(params.upX, params.upY, params.upZ);
        camera = GL.Mesh.camera(gl, pos, params.fov, lookat, up);
    };
    update();

    var sphere = GL.Mesh.sphere({ detail: 3 }).computeWireframe();
    var shader = new GL.Shader('\
        void main() {\
            gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        }\
        ', '\
        void main() {\
            gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);\
        }\
    ');

    gl.onmousemove = function(e) {
        if (e.dragging) {
            angleY += e.deltaX;
            angleX = Math.max(-90, Math.min(90, angleX + e.deltaY));
        }
    };

    gl.ondraw = function() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.matrixMode(gl.PROJECTION);
        gl.loadIdentity();
        gl.perspective(45, gl.canvas.width / gl.canvas.height, 1, 1000);
        gl.matrixMode(gl.MODELVIEW);
        gl.loadIdentity();
        gl.translate(0, 0, -5);
        gl.rotate(angleX, 1, 0, 0);
        gl.rotate(angleY, 0, 1, 0);
        shader.draw(camera, gl.LINES);
        shader.draw(sphere, gl.LINES);
    };

    gl.fullscreen({providedCanvas: true, fov: 45});
    gl.animate();
    gl.enable(gl.DEPTH_TEST);

});
