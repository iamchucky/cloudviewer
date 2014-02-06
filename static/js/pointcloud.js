$(function() {
    setupAxisOrb();
    document.getElementById("canvas").getContext("webgl", {premultipliedAlpha: false});

    // proceed with WebGL
    var gl = GL.create({preserveDrawingBuffer: true, canvas: document.getElementById('canvas')});

    // Define parameters
    var Parameters = function() {
        this.angleY = -45;
        this.angleX = 45;
        this.length = 10.0;
        this.time = 0;
        this.cameraTime = 0;
        this.cameraWindow = 0;
        this.rotation = GL.Matrix.identity();
        this.center = new GL.Vector(0, 0, 0);
        this.near = 0.5;
        this.far = 2500.0;
        this.camCount = 0;
        this.ptCount = 0;
        this.chunkCount = 0;
    };
    var params = new Parameters();
    // define the DAT.GUI
    var gui = new dat.GUI();
    gui.add(params, 'angleY', -180, 180).listen();
    gui.add(params, 'angleX', 0, 360).listen();
    gui.add(params, 'length', 0.5, 2500.0).step(0.5).listen();
    gui.add(params, 'near', 0.1, 2500.0).onFinishChange(function() {
        gl.setNearFar(params.near, params.far);
    });
    gui.add(params, 'far', 1.0, 2500.0).onFinishChange(function() {
        gl.setNearFar(params.near, params.far);
    });

    var fillPointMeta = function(data) {
      for (var d in data) {
        $('#point_meta_' + d).html(
            '<div style="width:100%">'+
              '<div>'+d+'</div>'+
              '<div style="position:absolute; right:10px">'+data[d]+'</div>'+
            '</div>');
      }
      $('#point_meta').show();
    };

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

    var particleSystem = [];
    var cameras = [];
    // depth map and shader
    var depthMap = new GL.Texture(1024, 1024, { format: gl.RGBA });
    var depthShader = new GL.Shader('\
        attribute vec2 t_range;\
        attribute float source;\
        uniform float sources[10];\
        uniform float time;\
        uniform float far;\
        uniform float near;\
        varying float depth;\
        void main() {\
            if (sources[int(source)] > 0.0 && t_range[0] <= time && t_range[1] >= time) {\
                gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
                depth = gl_Position.z;\
                vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
                gl_PointSize = 1.5*min(255.0, max(2.0, 512.0 / -cameraSpace.z));\
            } else {\
                gl_PointSize = 0.0;\
            }\
        }\
        ', '\
        uniform float near;\
        uniform float far;\
        varying float depth;\
        void main() {\
            gl_FragColor = vec4(vec3((depth-near)/(far-near)), 1.0);\
        }\
        ');
    // point id map and shader
    var pointIdMap = new GL.Texture(1024, 1024, { format: gl.RGBA });
    var pointIdShader = new GL.Shader('\
        attribute vec2 t_range;\
        attribute float source;\
        attribute float idx;\
        uniform float sources[10];\
        uniform float time;\
        varying vec4 color;\
        void main() {\
            if (sources[int(source)] > 0.0 && t_range[0] <= time && t_range[1] >= time) {\
                gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
                vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
                gl_PointSize = 1.5*min(255.0, max(2.0, 512.0 / -cameraSpace.z));\
                float idx0 = floor(idx/16777216.0)/255.0;\
                float idx1 = floor(mod(idx, 16777216.0)/65536.0)/255.0;\
                float idx2 = floor(mod(idx, 65536.0)/256.0)/255.0;\
                float idx3 = mod(idx, 256.0)/255.0;\
                color = vec4(idx0, idx1, idx2, idx3);\
            } else {\
                gl_PointSize = 0.0;\
            }\
        }\
        ', '\
        varying vec4 color;\
        void main() {\
            gl_FragColor = color;\
        }\
        ');

    // boring camera shader
    var cameraShader = new GL.Shader('\
        void main() {\
            gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        }\
        ', '\
        void main() {\
            gl_FragColor = vec4(0.5, 0.25, 0.5, 1.0);\
        }\
    ');
    // regular shader
    var particleShader = new GL.Shader('\
        attribute vec2 t_range;\
        attribute float source;\
        uniform float sources[10];\
        uniform float time;\
        uniform float far;\
        uniform float near;\
        varying vec4 color;\
        void main() {\
            if (sources[int(source)] > 0.0 && t_range[0] <= time && t_range[1] >= time) {\
                gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
                vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
                gl_PointSize = min(255.0, max(2.0, 512.0 / -cameraSpace.z));\
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
    var cameraDepthShader = new GL.Shader('\
        attribute float cameraId;\
        varying float fid;\
        void main() {\
            gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
            vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
            gl_PointSize = min(255.0, max(2.0, 512.0 / -cameraSpace.z));\
            fid = cameraId;\
        }\
        ', '\
        varying float fid;\
        void main() {\
            int id = int(fid);\
        }\
        ');
    // texture shader
    var texturePlane = GL.Mesh.plane({ coords: true, format: gl.RGBA });
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
        pointIdMap.bind();
        textureShader.draw(texturePlane);
        var pointId = samplePointIdMap(e.x, e.y, gl.canvas.width, gl.canvas.height);
        $.getJSON('api/getPt.json?num=1&start='+pointId, function(data) {
          if (data) {
            var pointData = data['points'][0];
            params.center = new GL.Vector(pointData['x'], pointData['y'], pointData['z']);
            fillPointMeta(data['points'][0]);
          }
        });
        gl.ondraw();
    };

    gl.rotateWorldXY = function(x, y, dx, dy) {
        var rotateSpeed = 180.0;
        var start = gl.unProject(x, y, 1);
        var xDir = gl.unProject(x+10, y, 1).subtract(start).unit();
        var yDir = gl.unProject(x, y+10, 1).subtract(start).unit();
        var mx = GL.Matrix.rotate(dy*rotateSpeed, xDir.x, xDir.y, xDir.z); 
        var my = GL.Matrix.rotate(dx*rotateSpeed, yDir.x, yDir.y, yDir.z); 
        params.rotation = params.rotation.multiply(my).multiply(mx);
        axisOrbRotation = params.rotation;
    }

    gl.onmousemove = function(e) {
        if (e.dragging) {
            params.angleX -= e.deltaX * 0.25;
            params.angleY += e.deltaY * 0.25;
            var minLength = Math.min(gl.canvas.width, gl.canvas.height);
            gl.rotateWorldXY(e.x, -e.y, e.deltaX/minLength, e.deltaY/minLength);

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

    var renderPointIdMap = function() {
      pointIdMap.unbind();
      pointIdMap.drawTo(function() {
        gl.clearColor(0, 0, 0, 0);
        gl.colorMask(true, true, true, true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderScene(pointIdShader);
      });
    };
    var samplePointIdMap = function(x, y, width, height) {
        var pixels = new Uint8Array(4);
        gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        var pointId = pixels[0]*16777216 + pixels[1]*65536 + pixels[2]*256 + pixels[3];
        //console.log(pointId);
        return pointId;
    }

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
        var depth = params.near + pixels[0]/255.0*(params.far-params.near);
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x, y);
        ray = ray.multiply(depth);
        var newCenter = tracer.eye.add(ray);
        params.center = newCenter;
    }

    var renderDepthOverlay = function() {
        depthMap.bind();
        gl.viewport(0, 0, 128, 128);
        textureShader.draw(texturePlane);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };

    gl.ondraw = function() {
        //gl.clearColor(18.0/255.0, 10.0/255.0, 143.0/255.0, 1.0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.loadIdentity();
        gl.matrixMode(gl.MODELVIEW);
        gl.translate(0, 0, -params.length);
        gl.multMatrix(params.rotation);
        gl.translate(-params.center.x, -params.center.y, -params.center.z);
        renderScene(particleShader);
        renderCameras();
        renderDepthMap();
        renderDepthOverlay();
        renderPointIdMap();
    };

    var renderScene = function(shader) {
        var sources = [];
        for (var k in params) {
            if (k.slice(0, 6) == 'source')
                sources.push(params[k] == true ? 1 : 0);
        }
        for (var i = 0; i < particleSystem.length; i++) {
            shader.uniforms({ near: params.near, 
                far: params.far, 
                time: params.time, 
                sources: sources })
            .draw(particleSystem[i], gl.POINTS);
        }
    };

    var renderCameras = function() {
        for (var i = 0; i < cameras.length; i++) {
            cameraShader.draw(cameras[i], gl.LINES); 
        }
    };

    // MAIN
    gl.fullscreen({providedCanvas: true, near: params.near, far: params.far, fov: 45});
    gl.animate();
    //gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
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
    $.getJSON('api/getInfo', function(data) {
      for (var source in data.sources) {
        params['source'+source] = true
        gui.add(params, 'source'+source);
      }
      params.time = (data.tmin + data.tmax) / 2;
      params.startTime = params.time;
      params.windowSize = (params.time - data.tmin)/4;
      params.camCount = 1000;//data.camCount;
      params.ptCount = data.ptCount;
      params.chunkCount = 2;//data.chunkCount;
      gui.add(params, 'time', data.tmin, data.tmax);
      gui.add(params, 'cameraTime', data.tmin, data.tmax);
      gui.add(params, 'cameraWindow', 0, data.tmax-data.tmin);
      // now get all the cameras then points
      fetchCameras(0, fetchParticles, [0, function() {
        $('#loading_text').hide();
      }]);
    });

    var fetchCameras = function(start, allDoneCallback, callbackArgs) {
      var num = 1000;
      start = start || 0;
      var end = params.camCount;
      $.getJSON('api/getCamera?num='+num+'&start='+start, function(data) {
        cameras.push(GL.Mesh.bundlerCameras(data['cameras']));
        if (start < end) {
          fetchCameras(start+num, allDoneCallback, callbackArgs);
        } else {
          if (allDoneCallback) {
            allDoneCallback.apply(this, callbackArgs);
          }
        }
      });
    };

    var fetchParticles = function(chunkId, allDoneCallback, callbackArgs) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'api/getPtChunk?id='+chunkId, true);
      xhr.responseType = 'arraybuffer';
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
      xhr.onload = function () {
        if (this.response) {
          var floatArray = new Float32Array(this.response);
          var floats = 10;
          var posArray = floatArray.subarray(0, 3*floatArray.length/floats);
          var colorArray = floatArray.subarray(3*floatArray.length/floats, 6*floatArray.length/floats);
          var timeArray = floatArray.subarray(6*floatArray.length/floats, 8*floatArray.length/floats);
          var sourceArray = floatArray.subarray(8*floatArray.length/floats, 9*floatArray.length/floats);
          var idxArray = floatArray.subarray(9*floatArray.length/floats, floatArray.length);
          var posBuffer = createBuffer(posArray, 3);
          var colorBuffer = createBuffer(colorArray, 3);
          var timeBuffer = createBuffer(timeArray, 2);
          var sourceBuffer = createBuffer(sourceArray, 1);
          var idxBuffer = createBuffer(idxArray, 1);
          var ps = new GL.Mesh({triangles:false, colors:true});
          ps.vertexBuffers['gl_Vertex'].buffer = posBuffer;
          ps.vertexBuffers['gl_Color'].buffer = colorBuffer;
          ps.addVertexBuffer('times', 't_range');
          ps.vertexBuffers['t_range'].buffer = timeBuffer;
          ps.addVertexBuffer('sources', 'source');
          ps.vertexBuffers['source'].buffer = sourceBuffer;
          ps.addVertexBuffer('idxs', 'idx');
          ps.vertexBuffers['idx'].buffer = idxBuffer;
          particleSystem.push(ps);
          if (chunkId < params.chunkCount-1) {
            fetchParticles(chunkId+1, allDoneCallback, callbackArgs);
          } else {
            if (allDoneCallback) {
              allDoneCallback.apply(this, callbackArgs);
            }
          }
        }
      };
      xhr.send(null);
    };

});
