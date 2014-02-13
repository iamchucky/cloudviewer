Number.prototype.padLeft = function (n,str){
  return Array(n-String(this).length+1).join(str||'0')+this;
};

$(function() {

  var timeProfile = null;
  google.setOnLoadCallback(function() {
    timeProfile = new TimeProfile();
  });

  // proceed with WebGL
  // NOTE: need antialias:false so that readPixels works as expected.
  // need alpha:true to allow alpha channel working.
  var gl = GL.create({
    antialias: false, 
    alpha: true, 
    preserveDrawingBuffer: true, 
    canvas: document.getElementById('canvas')
  });
  var trackball = new Trackball();
  var gl_invalidate = true;
  var enable_gl_invalidate = true;

  // Define parameters
  var Parameters = function() {
    this.length = 10.0;
    this.time = 0;
    this.cameraTime = 0;
    this.cameraWindow = 0;
    this.rotation = GL.Matrix.identity();
    this.center = new GL.Vector(0, 0, 0);
    this.near = 0.5;
    this.far = 2500.0;
    this.pointSize = 512.0;
    this.camCount = 0;
    this.ptCount = 0;
    this.chunkCount = 0;
    this.chunkSize = 0;
    this.resetTrackball = function() {
      trackball.invRotation = params.rotation.inverse();
    };
    this.dataset = '';
  };
  var params = new Parameters();
  params.dataset = $('#dataset').text();

  // define the DAT.GUI
  var gui = new dat.GUI();
  var viewsFolder = gui.addFolder('Views');
  viewsFolder.add(params, 'length', 0.5, 2500.0).step(0.5).listen()
    .onChange(function(val) {
      gl_invalidate = true;
    });
  viewsFolder.add(params, 'near', 0.1, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    gl_invalidate = true;
  });
  viewsFolder.add(params, 'far', 1.0, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    gl_invalidate = true;
  });
  viewsFolder.add(params, 'pointSize', 1.0, 512.0*16.0).step(1.0).listen()
    .onChange(function(val) {
      gl_invalidate = true;
    });
  viewsFolder.add(params, 'resetTrackball')
    .onChange(function(val) {
      gl_invalidate = true;
    });
  viewsFolder.open();

  var unixTimeToHumanDate = function(timestamp) {
    var date = new Date(timestamp * 1000),
        dateVals = [
          date.getFullYear(),
          (date.getMonth()+1).padLeft(2),
          date.getDate().padLeft(2)];
    return dateVals.join('/');
  };

  var fillPointMeta = function(data) {
    for (var d in data) {
      var val = 0;
      if (d == 'r' || d == 'g' || d == 'b' || d == 'idx') {
        val = data[d];
      } else if (d == 'x' || d == 'y' || d == 'z') {
        val = data[d].toFixed(3);
      } else if (d == 'tmin' || d == 'tmax') {
        val = unixTimeToHumanDate(data[d]);
      }
      $('#point_meta_' + d).html(
          '<div style="width:100%">'+
            '<div style="width:40px">'+d+'</div>'+
            '<div style="margin-left:10px">'+val+'</div>'+
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
  // point id map and shader
  var pointIdShader = new GL.Shader('\
    attribute vec2 t_range;\
    attribute float source;\
    attribute float idx;\
    uniform float sources[10];\
    uniform float time;\
    uniform float size;\
    varying vec4 color;\
    void main() {\
      if (sources[int(source)] > 0.0 && t_range[0] <= time && t_range[1] >= time) {\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
        gl_PointSize = min(16.0, max(2.0, size / -cameraSpace.z));\
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
      vec2 m = vec2(2.0*(gl_PointCoord.x - 0.5), 2.0*(gl_PointCoord.y - 0.5));\
      float a = m.x * m.x;\
      float b = m.y * m.y;\
      if (1.0-a-b < 0.0) {\
        discard;\
      }\
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
    uniform float size;\
    varying vec4 color;\
    void main() {\
      if (sources[int(source)] > 0.0 && t_range[0] <= time && t_range[1] >= time) {\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
        gl_PointSize = min(16.0, max(2.0, size / -cameraSpace.z));\
        color = gl_Color;\
      } else {\
        gl_PointSize = 0.0;\
      }\
    }\
    ', '\
    varying vec4 color;\
    void main() {\
      vec2 m = vec2(2.0*(gl_PointCoord.x - 0.5), 2.0*(gl_PointCoord.y - 0.5));\
      float a = m.x * m.x;\
      float b = m.y * m.y;\
      if (1.0-a-b < 0.0) {\
        discard;\
      }\
      gl_FragColor = color;\
    }\
  ');

  gl.ondblclick = function(e) {
    renderPointIdMap();
    var pointId = samplePointIdMap(e.x, e.y, gl.canvas.width, gl.canvas.height);
    if (pointId == 0) {
      gl_invalidate = true;
      gl.ondraw();
      return;
    }
    $.getJSON('api/getPtFromRowId?dataset='+params.dataset+'&rowid='+pointId, function(data) {
      if (data) {
        var pointData = data['points'][0];
        params.center = new GL.Vector(pointData['x'], pointData['y'], pointData['z']);
        gl_invalidate = true;

        fillPointMeta(pointData);
        if (timeProfile && data['time_intervals']) {
          timeProfile.drawChart(data['time_intervals']);
        }
      }
    });
    gl_invalidate = true;
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
    trackball.rotation = params.rotation;
  }

  var hitHyper = function(center, radius, viewpoint, viewplane, hitplane) {
    var hitplaney = center.subtract(hitplane).length();
    var viewpointx = center.subtract(viewpoint).length();

    var a = hitplaney/ viewpointx;
    var b = -hitplaney;
    var c = radius * radius / 2.0;
    var delta = b * b - 4 * a * c;

    if (delta > 0) {
      var x1 = (-b - Math.sqrt (delta)) / (2.0 * a);
      var x2 = (-b + Math.sqrt (delta)) / (2.0 * a);

      // always take the minimum value solution
      var xval = x1;
      // alternatively it also could be the other part of the equation 
      // yval=-(hitplaney/viewpointx)*xval+hitplaney;
      var yval = c / xval;

      // compute the result in 3d space
      var dirRadial = hitplane.subtract(center);
      dirRadial = dirRadial.unit();
      var dirView = viewplane.unit();
      var hit = center.add(dirRadial.multiply(yval)).add(dirView.multiply(xval));

      return hit;
    }
    return null;
  };

  // Code from MeshLab source at 
  // https://github.com/kylemcdonald/ofxVCGLib/blob/master/vcglib/wrap/gui/trackutils.h
  var hitSphere = function(x, y) {
    var radius = params.length / 10 * 2.5;
    var center = params.center;
    var tracer = new GL.Raytracer();
    var ray = tracer.getRayForPixel(x, y);
    
    var viewplane = getViewPlane();
    var viewpoint = tracer.eye;
    var hitplane = intersectionLinePlane(viewplane, ray, viewpoint);
    
    var resSp = GL.Raytracer.hitTestSphere(viewpoint, ray, params.center, radius);
    var resHp = hitHyper(center, radius, viewpoint, viewplane.normal, hitplane);

    // four cases
    // 1) Degenerate line tangent to both sphere and hyperboloid!
    if (!resSp && !resHp) {
      // most likely will never get hit
      return null;
    } 

    // 2) line cross only the sphere
    if (resSp && !resHp) {
      return resSp.hit;
    }

    // 3) line cross only the hyperboloid
    if (!resSp && resHp) {
      return resHp;
    }
    
    // 4) line cross both sphere and hyperboloid: choose according angle.
    var vpVec = viewpoint.subtract(center).unit();
    var resSpVec = resSp.hit.subtract(center).unit();
    var angleDeg = Math.acos(vpVec.dot(resSpVec))*180.0/Math.PI;
    
    if (angleDeg < 45) {
      return resSp.hit;
    } else {
      return resHp;
    }
  };

  var rotateWorldWithSphere = function(x, y, dx, dy) {
    var hitNew = hitSphere(x, y);
    if (!hitNew)
      return;
    var hitOld = hitSphere(x-dx, y-dy);
    if (!hitOld)
      return;

    var hitNewVec = hitNew.subtract(params.center).unit();
    var hitOldVec = hitOld.subtract(params.center).unit();
    var axis = hitNewVec.cross(hitOldVec).toArray();
    var angle = Math.acos(hitNewVec.dot(hitOldVec))*180.0/Math.PI;

    var m = GL.Matrix.rotate(-angle, axis[0], axis[1], axis[2]); 
    params.rotation = params.rotation.multiply(m);
    trackball.rotation = params.rotation;
  };

  var getViewPlane = function() {
    var center = params.center;
    var tracer = new GL.Raytracer();

    var viewpoint = tracer.eye;
    var plnorm = viewpoint.subtract(center);
    plnorm = plnorm.unit();
    var ploffset = plnorm.dot(center);
    return {normal: plnorm, offset: ploffset};
  };

  var intersectionLinePlane = function(plane, line, lineOrigin) {
    var epsilon = 1e-8;
    var k = plane.normal.dot(line);
    var hitplane = null;
    if ((k < -epsilon) || (k > epsilon)) {
      var r = (plane.offset - plane.normal.dot(lineOrigin))/k;  // Compute ray distance
      hitplane = lineOrigin.add(line.multiply(r));
    } else {
      //console.log('hitplane is null');
    }
    return hitplane;
  };

  var panWorldXY = function(x, y, dx, dy) {
    var tracer = new GL.Raytracer();
    var viewplane = getViewPlane();
    var viewpoint = tracer.eye;

    var oldRay = tracer.getRayForPixel(x-dx, y-dy);
    var oldHitplane = intersectionLinePlane(viewplane, oldRay, viewpoint);
    var newRay = tracer.getRayForPixel(x, y);
    var newHitplane = intersectionLinePlane(viewplane, newRay, viewpoint);

    var diff = oldHitplane.subtract(newHitplane);
    params.center = params.center.add(diff);
  };

  gl.onmouseup = function(e) {
    $('#canvas').css('cursor', 'auto');
    if (e.which == 3) {
      // reset trackball to current rotation
      params.resetTrackball();
      gl_invalidate = true;
    }
  };

  gl.onmousemove = function(e) {
    if (e.dragging && e.which != 3) {
      if (e.ctrlKey || e.which == 2) {
        // pan mode
        $('#canvas').css('cursor', 'move');
        panWorldXY(e.x, e.y, e.deltaX, e.deltaY);
      } else if (e.altKey) {
        // zoom mode
        if (e.deltaY < 0) {
          $('#canvas').css('cursor', '-webkit-zoom-in');
        } else {
          $('#canvas').css('cursor', '-webkit-zoom-out');
        }
        params.length += 150.0 * e.deltaY / gl.canvas.height;
      } else {
        // sphere mode
        $('#canvas').css('cursor', '-webkit-grabbing');
        rotateWorldWithSphere(e.x, e.y, e.deltaX, e.deltaY);
      }
      gl_invalidate = true;
    }
  };

  gl.onmousescroll = function (e) {
    if (e.altKey) {
      if (e.wheelDeltaY > 0) {
        params.pointSize *= 2.0;
      } else if (e.wheelDeltaY < 0) {
        params.pointSize /= 2.0;
      }
      params.pointSize = Math.min(512.0*16.0, Math.max(1.0, params.pointSize));
    } else {
      if (e.wheelDeltaY > 0) {
        params.length /= 2.0;
      } else if (e.wheelDeltaY < 0) {
        params.length *= 2.0;
      }
      params.length = Math.max(0.5, params.length);
    }
    gl_invalidate = true;
  }

  gl.onupdate = function(seconds) {
    var speed = seconds * 40;

    // Forward movement
    var up = GL.keys.UP | 0;
    var down = GL.keys.DOWN | 0;
    params.length += speed * (down - up);
    params.length = Math.max(0.0, params.length);
    if (up || down) {
      gl_invalidate = true;
    }

    // Sideways movement
    up = GL.keys.W | 0;
    down = GL.keys.S | 0;
    var left = GL.keys.A | 0;
    var right = GL.keys.D | 0;
    if (up || down || left || right) {
      gl.rotateWorldXY(0, 0, (right-left)/90.0, (down-up)/90.0);
      gl_invalidate = true;
    }
  };

  var renderPointIdMap = function() {
    gl.clearColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderScene(pointIdShader);
  };
  var samplePointIdMap = function(x, y, width, height) {
    var pixels = new Uint8Array(4);
    gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    var pointId = pixels[0]*16777216 + pixels[1]*65536 + pixels[2]*256 + pixels[3];
    return pointId;
  }

  gl.ondraw = function() {
    // be sure to set gl_invalidate to true to redraw
    if (enable_gl_invalidate && !gl_invalidate) {
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.matrixMode(gl.MODELVIEW);
    gl.translate(0, 0, -params.length);
    gl.multMatrix(params.rotation);
    gl.translate(-params.center.x, -params.center.y, -params.center.z);
    renderScene(particleShader);
    renderCameras();

    // use push matrix to allow different trackball translation from world
    gl.pushMatrix();
    gl.loadIdentity();
    gl.matrixMode(gl.MODELVIEW);
    gl.translate(0, 0, -10);
    gl.multMatrix(params.rotation);
    gl.multMatrix(trackball.invRotation);
    trackball.shader.draw(trackball.mesh, gl.LINES);
    gl.popMatrix();

    gl_invalidate = false;
  };

  var renderScene = function(shader) {
    var sources = [];
    for (var k in params) {
      if (k.slice(0, 6) == 'source')
        sources.push(params[k] == true ? 1 : 0);
    }
    for (var i = 0; i < particleSystem.length; i++) {
      shader.uniforms({ 
        size: params.pointSize,
        near: params.near, 
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
  gl_invalidate = true;
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
  $.getJSON('api/getInfo?dataset='+params.dataset, function(data) {
    params.time = (data.tmin + data.tmax) / 2;
    params.startTime = params.time;
    params.windowSize = (params.time - data.tmin)/4;
    params.camCount = 0;//data.camCount;
    params.ptCount = data.ptCount;
    params.chunkCount = 1; //data.chunkCount;
    params.chunkSize = data.chunkSize;

    $('#current_time').text(unixTimeToHumanDate(params.time));
    // setup gui control
    var timesFolder = gui.addFolder('Times');
    var timeControl = timesFolder.add(params, 'time', data.tmin, data.tmax)
    timeControl.onChange(function(val) {
      $('#current_time').text(unixTimeToHumanDate(params.time));
      gl_invalidate = true;
    });
    timesFolder.add(params, 'cameraTime', data.tmin, data.tmax)
      .onChange(function(val) {
        gl_invalidate = true;
      });
    timesFolder.add(params, 'cameraWindow', 0, data.tmax-data.tmin)
      .onChange(function(val) {
        gl_invalidate = true;
      });
    timesFolder.open();

    if (data.sources) {
      var sourcesFolder = gui.addFolder('Sources');
      for (var s in data.sources) {
        params['source'+s] = true
        sourcesFolder.add(params, 'source'+s).onChange(function(val) {
          gl_invalidate = true;
        });
      }
    }

    // now get all the cameras then points
    fetchCameras(0, fetchParticles, [0, function() {
      $('#loading_text').hide();
    }]);
  });

  var fetchCameras = function(start, allDoneCallback, callbackArgs) {
    var num = 1000;
    start = start || 0;
    if (params.camCount == 0) {
      if (allDoneCallback) {
        allDoneCallback.apply(this, callbackArgs);
      }
      return;
    }
    $.getJSON('api/getCamera?dataset='+params.dataset+'&num='+num+'&start='+start, 
    function(data) {
      cameras.push(GL.Mesh.bundlerCameras(data['cameras']));
      if (start + num < params.camCount) {
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
    xhr.open('GET', 'api/getPtChunk?dataset='+params.dataset+'&id='+chunkId, true);
    xhr.responseType = 'arraybuffer';
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.onload = function () {
      if (this.response) {
        var chunkSize = params.chunkSize;
        var floatArray = new Float32Array(this.response);
        var posArray = floatArray.subarray(0, 3*chunkSize);
        var colorArray = floatArray.subarray(3*chunkSize, 6*chunkSize);
        var timeArray = floatArray.subarray(6*chunkSize, 8*chunkSize);
        var sourceArray = floatArray.subarray(8*chunkSize, 9*chunkSize);
        var idxArray = floatArray.subarray(9*chunkSize, floatArray.length);
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

        gl_invalidate = true;
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
