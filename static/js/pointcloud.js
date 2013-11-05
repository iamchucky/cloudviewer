$(function() {

    // Define parameters
    var near = 0.5;
    var far = 2500.0;
    var Parameters = function() {
        this.angleY = -45;
        this.angleX = 45;
        this.length = 10.0;
        this.time = 0;
    };
    var params = new Parameters();
    // define the DAT.GUI
    var gui = new dat.GUI();
    gui.add(params, 'angleY', -180, 180).listen();
    gui.add(params, 'angleX', 0, 360).listen();
    gui.add(params, 'length', 0.5, far).step(0.5).listen();

    // proceed with WebGL
    var gl = GL.create({preserveDrawingBuffer: true, canvas: document.getElementById('canvas')});

    var dblclick = function (e) {
        if (gl.ondblclick) gl.ondblclick(e);
        e.preventDefault();
    };
    gl.canvas.addEventListener('dblclick', dblclick);

    var mousescroll = function (e) {
        if (gl.onmousescroll) gl.onmousescroll(e);
        e.preventDefault();
    };
    var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? 'DOMMouseScroll' : 'mousewheel';
    gl.canvas.addEventListener(mousewheelevt, mousescroll);

    var center = new GL.Vector(0, 0, 0);
    var particleSystem = [];
    // depth map and shader
    var depthMap = new GL.Texture(1024, 1024, { format: gl.RGBA });
    var depthShader = new GL.Shader('\
        uniform float far;\
        varying vec4 position;\
        void main() {\
            gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
            gl_PointSize = max(1.0, (far / gl_Position.z))/16.0;\
            position = gl_Vertex;\
        }\
        ', '\
        uniform float far;\
        varying vec4 position;\
        void main() {\
            float depth = position.z / far;\
            gl_FragColor = vec4(position.xyz/512.0, 1.0);\
        }\
        ');
    // regular shader
    var particleShader = new GL.Shader('\
        attribute vec2 t_range;\
        uniform float time;\
        uniform float far;\
        varying vec4 color;\
        void main() {\
            if (t_range[0] <= time && t_range[1] >= time) {\
                gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
                gl_PointSize = max(2.0, (128.0 / gl_Position.z));\
                color = gl_Color;\
            } else {\
                gl_PointSize = 0.0;\
            }\
        }\
        ', '\
        varying vec4 color;\
        void main() {\
            float a = pow(2.0*(gl_PointCoord.x-0.5), 2.0);\
            float b = pow(2.0*(gl_PointCoord.y-0.5), 2.0);\
            if (1.0-a-b < 0.0) {\
                discard;\
            }\
            gl_FragColor = color;\
        }\
        ');
    // texture shader
    var texturePlane = GL.Mesh.plane({ coords: true });
    var textureShader = new GL.Shader('\
        varying vec2 coord;\
        void main() {\
            coord = gl_TexCoord.xy;\
            gl_Position = vec4(coord * 2.0 - 1.0, 0.0, 1.0);\
        }\
        ', '\
        uniform sampler2D texture;\
        varying vec2 coord;\
        void main() {\
            gl_FragColor = texture2D(texture, coord);\
        }\
        ');

    gl.ondblclick = function(e) {
        depthMap.bind();
        textureShader.draw(texturePlane);
        sampleDepthMap(e.x, e.y, gl.canvas.width, gl.canvas.height);
        gl.ondraw()
    };

    gl.onmousemove = function(e) {
        if (e.dragging) {
            params.angleX -= e.deltaX * 0.25;
            params.angleY += e.deltaY * 0.25;
    
            if (params.angleY > 180.0) {
                params.angleY -= 360.0;
            } else if (params.angleY < -180.0) {
                params.angleY += 360.0;
            }
        }
    };

    gl.onmousescroll = function (e) {
        if (e.wheelDeltaY > 0) {
            params.length /= 2.0;
        } else if (e.wheelDeltaY < 0) {
            params.length *= 2.0;
        }
        params.length = Math.max(0.5, params.length);
    }

    gl.onupdate = function(seconds) {
        var speed = seconds * 4;

        // Forward movement
        var up = GL.keys.UP | 0;
        var down = GL.keys.DOWN | 0;
        params.length += speed * (down - up);
        params.length = Math.max(0.0, params.length);

        // Sideways movement
        up = GL.keys.W | 0;
        down = GL.keys.S | 0;
        var left = GL.keys.A | 0;
        var right = GL.keys.D | 0;
        params.angleY += 10.0 * speed * (down - up);
        params.angleX += 10.0 * speed * (left - right);
    };

    var renderDepthMap = function() {
        depthMap.unbind();
        depthMap.drawTo(function() {
            gl.clearColor(1, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            renderScene(depthShader);
        });
    };

    var sampleDepthMap = function(x, y, width, height) {
        var pixels = new Uint8Array(4);
        gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (pixels[0] == 255)
            return;
        var depth = pixels[0]/255.0*128;
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x, y);
        ray = ray.multiply(depth/ray.z);
        // need camera position
        var newCenter = tracer.eye.add(ray);
        console.log(center, tracer.eye);
        //console.log(center.subtract(tracer.eye).length(), params.length);
        console.log(center, newCenter)
        center.x = pixels[0]*2.0;
        center.y = pixels[1]*2.0;
        center.z = pixels[2]*2.0;
        console.log(pixels)
    }

    var renderDepthOverlay = function() {
        depthMap.bind();
        gl.viewport(0, 0, 128, 128);
        textureShader.draw(texturePlane);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };

    gl.ondraw = function() {
        gl.clearColor(18.0/255.0, 10.0/255.0, 143.0/255.0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.loadIdentity();
        gl.matrixMode(gl.MODELVIEW);
        gl.translate(0, 0, -params.length);
        gl.rotate(params.angleX, 0, -1, 0);
        gl.rotate(params.angleY, 1, 0, 0);
        gl.translate(-center.x, -center.y, -center.z);
        renderScene(particleShader);
        renderDepthMap();
        renderDepthOverlay();
    };

    var renderScene = function(shader) {
        for (var i = 0; i < particleSystem.length; i++) {
            shader.uniforms({ far: far, time: params.time }).draw(particleSystem[i], gl.POINTS);
        }
    };

    // MAIN
    gl.fullscreen({providedCanvas: true, paddingBottom: 50, near: near, far: far, fov: 45});
    gl.animate();
    //gl.enable(gl.CULL_FACE);
    gl.clearColor(1.0, 1.0, 1.0, 1);
    gl.enable(gl.DEPTH_TEST);

    var createBuffer = function(array, spacing) {
        var buffer = gl.createBuffer();
        buffer.length = array.length;
        buffer.spacing = spacing;
        gl.bindBuffer (gl.ARRAY_BUFFER, buffer);
        gl.bufferData (gl.ARRAY_BUFFER, array, gl.STATIC_DRAW); 
        return buffer;
    }

    // get the time range
    $.getJSON('api/getTimeRange', function(data) {
        gui.add(params, 'time', data.tmin, data.tmax);
    });

    // now get all the particles
    var num = 100000;
    for (var i = 0; i < 1; i++) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'api/getPt?num='+num+'&start='+(i*num), true);
        xhr.responseType = 'arraybuffer';
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
        xhr.onload = function () {
            if (this.response) {
                var floatArray = new Float32Array(this.response);
                var posArray = floatArray.subarray(0, 3*floatArray.length/8);
                var colorArray = floatArray.subarray(3*floatArray.length/8, 6*floatArray.length/8);
                var timeArray = floatArray.subarray(6*floatArray.length/8, floatArray.length);
                var posBuffer = createBuffer(posArray, 3);
                var colorBuffer = createBuffer(colorArray, 3);
                var timeBuffer = createBuffer(timeArray, 2);
                var ps = new GL.Mesh({triangles:false, colors:true});
                ps.vertexBuffers['gl_Vertex'].buffer = posBuffer;
                ps.vertexBuffers['gl_Color'].buffer = colorBuffer;
                ps.addVertexBuffer('times', 't_range');
                ps.vertexBuffers['t_range'].buffer = timeBuffer;
                particleSystem.push(ps);
            }
        };
        xhr.send(null);

        /*
        $.getJSON('api/getPt.json?num='+num+'&start='+(num*i), function(data) {
            var centroid = [0, 0, 0];
            //var ps = new GL.Mesh({ colors: 1 });
            for (var i = 0; i < data.points.length; i++) {
                datum = data.points[i];
                centroid[0] += datum.x;
                centroid[1] += datum.y;
                centroid[2] += datum.z;
            //    ps.vertices.push([datum.x, datum.y, datum.z]);
            //    ps.colors.push([datum.r/255.0, datum.g/255.0, datum.b/255.0, 1.0]);
            //    ps.triangles.push([i, i, i]);
            }
            //ps.compile();
            //particleSystem.push(ps);
            center.x = centroid[0] / data.points.length;
            center.y = centroid[1] / data.points.length;
            center.z = centroid[2] / data.points.length;
        });
        */
    }

});
