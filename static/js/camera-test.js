$(function() {

    // proceed with WebGL
    var gl = GL.create({preserveDrawingBuffer: true, canvas: document.getElementById('canvas')});
    var angleX = 0;
    var angleY = 0;

    var Parameters = function() {
        this.length = 5;
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

    // the first example from ET
    var bundlerCameras = [];
    var f = 6.8342884734e+02;
    var k1 = -8.4659598391e-02;
    var k2 = -1.6636491266e-03;
    var R = new GL.Matrix(9.2771255870e-01, -3.0337479532e-01, -2.1751584312e-01, 0,
        3.2505575698e-01, 3.7001665715e-01, 8.7030249241e-01, 0,
        -1.8354335535e-01, -8.7809532911e-01, 4.4188282350e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(-1.2929377478e+00, 5.2709726605e+00, -3.5961823466e+00);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.9416663747e+02;
    var k1 = -9.2576830301e-02;
    var k2 = 1.3775928822e-02;
    var R = new GL.Matrix(9.7142044667e-01, -1.7491642160e-01, -1.6045735023e-01, 0,
        2.3715583056e-01, 7.4361295195e-01, 6.2513749666e-01, 0,
        9.9713499420e-03, -6.4532474240e-01, 7.6384327518e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(-6.9433614363e-01, 3.7132357553e+00, -2.7471279934e+00);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.8655410355e+02;
    var k1 = -8.6792393851e-02;
    var k2 = -9.4246113619e-05;
    var R = new GL.Matrix(9.5014245689e-01, -2.4461668771e-01, -1.9337007968e-01, 0,
        2.6517177297e-01, 3.0760839681e-01, 9.1381672399e-01, 0,
        -1.6405256000e-01, -9.1953235414e-01, 3.5713723868e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(-1.1036383962e+00, 5.3499064115e+00, -4.1230400203e+00);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.9246346201e+02;
    var k1 = -8.0576084526e-02;
    var k2 = -2.5605386746e-02;
    var R = new GL.Matrix(9.0915455560e-01, -3.8316627230e-01, 1.6316127544e-01, 0,
        1.3886592099e-01, 6.4827855681e-01, 7.4863286648e-01, 0,
        -3.9262482094e-01, -6.5796544024e-01, 6.4259414052e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(1.3096118463e+00, 4.3049601868e+00, -2.4749939087e+00);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.8492819439e+02;
    var k1 = -1.3836464782e-01;
    var k2 = -9.1807459129e-03;
    var R = new GL.Matrix(9.6900020801e-01, 7.9088923109e-02, 2.3405883688e-01, 0,
        -7.1262955661e-02, 9.9658467432e-01, -4.1720235603e-02, 0,
        -2.3655905823e-01, 2.3747192463e-02, 9.7132686713e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(1.3857183845e+00, -2.9406252708e-01, -4.4412033352e-01);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.8327919943e+02;
    var k1 = -1.2278924051e-01;
    var k2 = -2.7048338379e-02;
    var R = new GL.Matrix(9.9993403554e-01, -9.7593141212e-03, 6.0564311563e-03, 0,
        9.7125747599e-03, 9.9992319019e-01, 7.6993255116e-03, 0,
        -6.1311060992e-03, -7.6399940894e-03, 9.9995201886e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(1.0594095686e-01, 2.2464434939e-02, -4.7708863934e-01);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.8538809345e+02;
    var k1 = -1.3676505830e-01;
    var k2 = 2.7173363847e-02;
    var R = new GL.Matrix(9.9722732772e-01, 4.0987462543e-02, 6.2110262922e-02, 0,
        -3.8340390983e-02, 9.9832928432e-01, -4.3227936508e-02, 0,
        -6.3778297760e-02, 4.0726747842e-02, 9.9713271972e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(7.2303634691e-01, -7.2333915163e-01, -9.4071995609e-01);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));
    var f = 6.8300299883e+02;
    var k1 = -1.2397648847e-01;
    var k2 = -1.4242620399e-02;
    var R = new GL.Matrix(-9.2664126236e-01, -3.2756814425e-01, -1.8448599344e-01, 0,
        2.7359767302e-01, -9.2414393139e-01, 2.6665015920e-01, 0,
        -2.5783770907e-01, 1.9661410162e-01, 9.4597178120e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(-5.2729402376e-01, 2.5424960663e+00, -1.1710136997e+00);
    bundlerCameras.push(GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t));

    var f = 6.8342884734e+02;
    var k1 = -8.4659598391e-02;
    var k2 = -1.6636491266e-03;
    var R = new GL.Matrix(9.2771255870e-01, -3.0337479532e-01, -2.1751584312e-01, 0,
        3.2505575698e-01, 3.7001665715e-01, 8.7030249241e-01, 0,
        -1.8354335535e-01, -8.7809532911e-01, 4.4188282350e-01, 0,
        0, 0, 0, 1);
    var t = new GL.Vector(-1.2929377478e+00, 5.2709726605e+00, -3.5961823466e+00);
    var bundlerCamera = GL.Mesh.bundlerCamera(gl, f, k1, k2, R, t);

    var params = new Parameters();
    // define the DAT.GUI
    var gui = new dat.GUI();
    gui.add(params, 'length', 1.0, 20.0).onChange(function() { update(); });
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
            gl_FragColor = vec4(0.5, 0.25, 0.5, 1.0);\
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
        gl.translate(0, 0, -params.length);
        gl.rotate(angleX, 1, 0, 0);
        gl.rotate(angleY, 0, 1, 0);
        // shader.draw(camera, gl.LINES);
        // shader.draw(sphere, gl.LINES);
        bundlerCameras.forEach(function(c) {
            shader.draw(c, gl.LINES);
        });
    };

    gl.fullscreen({providedCanvas: true, fov: 45});
    gl.animate();
    gl.enable(gl.DEPTH_TEST);

});
