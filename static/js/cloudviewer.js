var Parameters = function() {
  this.cameraZ = 10.0;
  this.time = 0;
  this.rotation = GL.Matrix.identity();
  this.center = new GL.Vector(0, 0, 0);
  this.near = 0.5;
  this.far = 2500.0;
  this.pointSize = 1.0;
  this.camCount = 0;
  this.ptCount = 0;
  this.chunkCount = 0;
  this.chunkSize = 0;
  this.resetTrackball = function() {
    cloudViewer.trackball.invRotation = cloudViewer.params.rotation.inverse();
  };
  this.dataset = '';
  this.showPhotoStrip = false;
  this.currPointId = -1;
  this.showFps = true;
  this.roundPoints = false;
  this.showClusterId = false;
  this.currClusterId1 = -2.0;
  this.currClusterId2 = -2.0;
  this.clusterColor1 = '#ff0000';
  this.clusterColor2 = '#ffffff';
  this.showShortkeyHelp = true;
};

var CloudViewer = function() {
  this.gl = null;
  this.gui = null;
  this.guiZoom = null;
  this.guiPointSize = null;
  this.glInvalidate = true;
  this.enable_glInvalidate = true;
  this.params = new Parameters();
  this.timeChart = null;
  this.trackball = null;
  this.stats = null;
  this.shaders = null;;

  this.particleSystem = [];
  this.cameras = [];
};

CloudViewer.prototype.setupGL = function() {
  var cv = this;
  var params = this.params;

  // NOTE: need antialias:false so that readPixels works as expected.
  // need alpha:true to allow alpha channel working.
  var gl = GL.create({
    antialias: false, 
    alpha: true, 
    preserveDrawingBuffer: true, 
    canvas: document.getElementById('canvas')
  });
  this.gl = gl;
  this.trackball = new Trackball();
  this.setupShaders();

  gl.canvas.addEventListener('dblclick', function(e) {
    if (gl.ondblclick) gl.ondblclick(e);
    e.preventDefault();
  });

  var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? 'DOMMouseScroll' : 'mousewheel';
  gl.canvas.addEventListener(mousewheelevt, function(e) {
    if (gl.onmousescroll) gl.onmousescroll(e);
    e.preventDefault();
  });

  gl.ondblclick = function(e) {
    cv.renderIdMap(cv.shaders.pointId);
    var x = e.x | e.clientX;
    var y = e.y | e.clientY;
    var pointId = cv.sampleIdMap(x, y, gl.canvas.width, gl.canvas.height);
    if (pointId == 0) {
      cv.glInvalidate = true;
      gl.ondraw();
      return;
    }
    params.currPointId = pointId;
    $.getJSON('api/getPtFromIdx?dataset='+params.dataset+'&idx='+pointId, function(data) {
      if (data) {
        var pointData = data['points'][0];
        params.center = new GL.Vector(pointData['x'], pointData['y'], pointData['z']);
        cv.glInvalidate = true;

        cv.fillPointMeta(pointData);
        if (cv.timeChart && data['time_intervals']) {
          cv.timeChart.draw(data, params.tmax, params.tmin);
          $('#top_container').css('top','0px');
        }
      }
    });
    if (params.showPhotoStrip) {
      cv.getPointPhotos();
    }
    cv.glInvalidate = true;
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
    cv.trackball.rotation = params.rotation;
  };

  gl.onmouseup = function(e) {
    $('#canvas').css('cursor', 'auto');
    if (e.which == 3) {
      // reset trackball to current rotation
      params.resetTrackball();
      cv.glInvalidate = true;
    }
  };

  gl.onmousemove = function(e) {
    if (e.dragging && e.which != 3) {
      if (e.ctrlKey || e.which == 2) {
        // pan mode
        $('#canvas').css('cursor', 'move');
        cv.panWorldXY(e.x, e.y, e.deltaX, e.deltaY);
      } else if (e.altKey) {
        // zoom mode
        if (e.deltaY < 0) {
          $('#canvas').css('cursor', '-webkit-zoom-in');
        } else {
          $('#canvas').css('cursor', '-webkit-zoom-out');
        }
        params.cameraZ += 150.0 * e.deltaY / gl.canvas.height;
        params.cameraZ = Math.min(2048.0, Math.max(1.0, params.cameraZ));
        cv.guiZoom.updateDisplay();
      } else {
        // sphere mode
        $('#canvas').css('cursor', '-webkit-grabbing');
        cv.rotateWorldWithSphere(e.x, e.y, e.deltaX, e.deltaY);
      }
      cv.glInvalidate = true;
    }

    if (!e.dragging && (e.ctrlKey || e.altKey) && cloudViewer.params.showClusterId) {
      cloudViewer.renderIdMap(cloudViewer.shaders.clusterId);
      var x = e.x | e.clientX;
      var y = e.y | e.clientY;
      var pointId = cloudViewer.sampleIdMap(x, y, gl.canvas.width, gl.canvas.height);
      if (pointId == 0) {
        if (e.ctrlKey) {
          params.currClusterId1 = -2.0;
        } else {
          params.currClusterId2 = -2.0;
        }
        cv.glInvalidate = true;
        gl.ondraw();
        return;
      }
      if (e.ctrlKey) {
        params.currClusterId1 = Math.floor(pointId/256.0);
      } else {
        params.currClusterId2 = Math.floor(pointId/256.0);
      }
      cv.glInvalidate = true;
      gl.ondraw();
    }
  };

  gl.onmousescroll = function (e) {
    var wheelDelta = e.wheelDeltaY | e.wheelDelta | e.detail*-1;
    if (e.altKey) {
      if (wheelDelta > 0) {
        params.pointSize *= 2.0;
      } else if (wheelDelta < 0) {
        params.pointSize /= 2.0;
      }
      params.pointSize = Math.min(512.0, Math.max(1.0, params.pointSize));
      cv.guiPointSize.updateDisplay();
    } else {
      if (wheelDelta > 0) {
        params.cameraZ /= 2.0;
      } else if (wheelDelta < 0) {
        params.cameraZ *= 2.0;
      }
      params.cameraZ = Math.min(2048.0, Math.max(1.0, params.cameraZ));
      cv.guiZoom.updateDisplay();
    }
    cv.glInvalidate = true;
  }

  gl.onupdate = function(seconds) {
    var speed = seconds * 40;

    // Forward movement
    var up = GL.keys.UP | 0;
    var down = GL.keys.DOWN | 0;
    if (up || down) {
      params.cameraZ += speed * (down - up);
      params.cameraZ = Math.min(2048.0, Math.max(1.0, params.cameraZ));
      cv.guiZoom.updateDisplay();
      cv.glInvalidate = true;
    }

    // Sideways movement
    up = GL.keys.W | 0;
    down = GL.keys.S | 0;
    var left = GL.keys.A | 0;
    var right = GL.keys.D | 0;
    if (up || down || left || right) {
      gl.rotateWorldXY(0, 0, (right-left)/90.0, (down-up)/90.0);
      cv.glInvalidate = true;
    }
  };


  gl.ondraw = function() {
    if (params.showFps && cv.stats) {
      cv.stats.update();
    }
    // be sure to set glInvalidate to true to redraw
    if (cv.enable_glInvalidate && !cv.glInvalidate) {
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.matrixMode(gl.MODELVIEW);
    gl.translate(0, 0, -params.cameraZ);
    gl.multMatrix(params.rotation);
    gl.translate(-params.center.x, -params.center.y, -params.center.z);
    cv.renderScene(cv.shaders.particle);
    cv.renderCameras();

    // use push matrix to allow different trackball translation from world
    if (cv.trackball) {
      gl.pushMatrix();
      gl.loadIdentity();
      gl.matrixMode(gl.MODELVIEW);
      gl.translate(0, 0, -10);
      gl.multMatrix(params.rotation);
      gl.multMatrix(cv.trackball.invRotation);
      cv.trackball.shader.draw(cv.trackball.mesh, gl.LINES);
      gl.popMatrix();
    }

    cv.glInvalidate = false;
  };

  gl.fullscreen({providedCanvas: true, near: params.near, far: params.far, fov: 45});
  cv.glInvalidate = true;
  gl.animate();
  //gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
};

CloudViewer.prototype.setupShaders = function() {
  // Define all shaders
  this.shaders = {
    pointId: new GL.Shader(glsl.pointId.vertex, glsl.pointId.fragment),
    clusterId: new GL.Shader(glsl.clusterId.vertex, glsl.clusterId.fragment),
    camera: new GL.Shader(glsl.camera.vertex, glsl.camera.fragment),
    particle: new GL.Shader(glsl.particle.vertex, glsl.particle.fragment)
  };
};

CloudViewer.prototype.setupUI = function() {
  var cv = this;
  var params = this.params;

  var stats = new Stats();
  $('#top_container')[0].appendChild( stats.domElement );
  this.stats = stats;

  this.setupDatGui();

  // setup the time player
  var timelapseHandle = null;
  var startTimelapse = function() {
    if ($('#time_seekbar').val() == $('#time_seekbar').attr('max')) {
      params.time = parseFloat($('#time_seekbar').attr('min'));
      $('#time_seekbar').val(params.time);
    }

    $('#play_pause').removeClass('fa-play').addClass('fa-pause');
    var playbackInterval = setInterval(function() {
      if (params.time > $('#time_seekbar').attr('max')) {
        pauseTimelapse();
        return;
      }
      params.time += 24*3600.0;
      $('#current_time').text(utils.unixTimeToHumanDateStr(params.time));
      $('#time_seekbar').val(params.time);
      cv.glInvalidate = true;
    }, 50);
    return playbackInterval;
  };
  var pauseTimelapse = function() {
    $('#play_pause').removeClass('fa-pause').addClass('fa-play');
    clearInterval(timelapseHandle);
  };

  $('#play_pause').click(function() {
    var classes = $(this).attr('class');
    if (classes.match(/fa-pause/g)) {
      pauseTimelapse();
    } else {
      timelapseHandle = startTimelapse();
    }
  });
};

CloudViewer.prototype.setupDatGui = function() {
  var cv = this;
  var params = this.params;
  var gl = this.gl;
  var gui = new dat.GUI({ autoPlace: false });
  document.getElementById('dat_gui_container').appendChild(gui.domElement);

  var clustersFolder = gui.addFolder('Clusters');
  clustersFolder.add(params, 'showClusterId')
    .name('color by cluster')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  clustersFolder.addColor(params, 'clusterColor1')
    .name('color1')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  clustersFolder.addColor(params, 'clusterColor2')
    .name('color2')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  clustersFolder.open();

  cv.guiZoom = gui.add(params, 'cameraZ', 1.0, 2048.0)
    .name('camera z')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  gui.add(params, 'near', 0.1, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    cv.glInvalidate = true;
  });
  gui.add(params, 'far', 1.0, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    cv.glInvalidate = true;
  });
  cv.guiPointSize = gui.add(params, 'pointSize', 1.0, 512.0)
    .name('point size')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  gui.add(params, 'resetTrackball')
    .name('reset trackball')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  gui.add(params,'roundPoints').name('rounded points')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  gui.add(params, 'showFps')
    .name('fps')
    .onFinishChange(function(val) {
      if (val) {
        $('#stats').show();
      } else {
        $('#stats').hide();
      }
    });
  gui.add(params, 'showShortkeyHelp')
    .name('shortkey help')
    .onFinishChange(function(val) {
      if (val) {
        $('#shortkey_help').show();
      } else {
        $('#shortkey_help').hide();
      }
    });
  gui.add(params, 'showPhotoStrip')
    .name('photostrip')
    .onChange(function(val) {
      var photoStripBottom = val ? 0:-130; 
      $('#bottom_container').css('bottom', photoStripBottom + 'px');
      setTimeout(function() {
        gl.fullscreen({
          providedCanvas: true, 
          near: params.near, 
          far: params.far, 
          fov: 45,
          paddingBottom: photoStripBottom + 130
        });
        cv.glInvalidate = true;
      }, val?200:0);
      if (val) {
        cv.getPointPhotos();
      }
    });
  this.gui = gui;
};

CloudViewer.prototype.getPointPhotos = function() {
  if (this.params.currPointId == -1) {
    return;
  }
  //console.log(this.params.currPointId);

  // fetch photo urls
  var photoUrls = ['test1', 'test2'];
  var photoStripContainer = $('#photo_strip ul');
  photoStripContainer.empty();
  var photoCount = 15;
  $('#photo_strip ul').css('width', photoCount*206+'px');

  // populate the photos
  //for (var i = 0; i < photoUrls.length; ++i) {
  for (var i = 0; i < photoCount; ++i) {
    var url = 'http://farm8.staticflickr.com/7350/12504958043_0e45727769_m.jpg';
    var fullUrl = 'http://farm8.staticflickr.com/7350/12504958043_0e45727769_c.jpg';
    var elem = $('<li url="'+fullUrl+'" style="background-image:url('+url+')"></li>')
      .click(function() {
        window.open($(this).attr('url'));
      });
    photoStripContainer.append(elem);
  }
};

CloudViewer.prototype.fillPointMeta = function(data) {
  for (var d in data) {
    var val = 0;
    if (d == 'r' || d == 'g' || d == 'b' || d == 'idx') {
      val = data[d];
    } else if (d == 'x' || d == 'y' || d == 'z') {
      val = data[d].toFixed(3);
    } else if (d == 'tmin' || d == 'tmax') {
      val = utils.unixTimeToHumanDateStr(data[d]);
    }
    $('#point_meta_' + d).html(
        '<div style="width:100%">'+
          '<div style="width:40px">'+d+'</div>'+
          '<div style="margin-left:10px">'+val+'</div>'+
        '</div>');
  }
  $('#point_meta').show();
};

CloudViewer.prototype.renderIdMap = function(shader) {
  var gl = this.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.colorMask(true, true, true, true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  this.renderScene(shader);
};

CloudViewer.prototype.sampleIdMap = function(x, y, width, height) {
  var gl = this.gl;
  var pixels = new Uint8Array(4);
  gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  var pointId = pixels[0]*16777216 + pixels[1]*65536 + pixels[2]*256 + pixels[3];
  return pointId;
};

CloudViewer.prototype.renderScene = function(shader) {
  if (!this.particleSystem) {
    return;
  }

  var params = this.params;
  var uniforms = { 
    cluster1: params.showClusterId ? params.currClusterId1 : -1.0,
    cluster2: params.showClusterId ? params.currClusterId2 : -1.0,
    clusterColor1: parseInt(params.clusterColor1.replace('#',''), 16),
    clusterColor2: parseInt(params.clusterColor2.replace('#',''), 16),
    round: params.roundPoints ? 1.0 : 0.0,
    size: params.pointSize,
    near: params.near, 
    far: params.far, 
    time: params.time 
  };
  for (var i = 0; i < this.particleSystem.length; i++) {
    shader.uniforms(uniforms)
      .draw(this.particleSystem[i], this.gl.POINTS);
  }
};

CloudViewer.prototype.renderCameras = function() {
  if (!this.cameras) {
    return;
  }

  for (var i = 0; i < this.cameras.length; i++) {
    this.shaders.camera.draw(this.cameras[i], this.gl.LINES); 
  }
};


  // Code from MeshLab source at 
  // https://github.com/kylemcdonald/ofxVCGLib/blob/master/vcglib/wrap/gui/trackutils.h
CloudViewer.prototype.hitSphere = function(x, y) {
  var params = this.params;
  var radius = params.cameraZ / 10 * 2.5;
  var center = params.center;
  var tracer = new GL.Raytracer();
  var ray = tracer.getRayForPixel(x, y);
  
  var viewplane = utils.getViewPlane(params.center);
  var viewpoint = tracer.eye;
  var hitplane = utils.intersectionLinePlane(viewplane, ray, viewpoint);
  
  var resSp = GL.Raytracer.hitTestSphere(viewpoint, ray, params.center, radius);
  var resHp = utils.hitHyper(center, radius, viewpoint, viewplane.normal, hitplane);

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

CloudViewer.prototype.rotateWorldWithSphere = function(x, y, dx, dy) {
  var hitNew = this.hitSphere(x, y);
  if (!hitNew)
    return;
  var hitOld = this.hitSphere(x-dx, y-dy);
  if (!hitOld)
    return;

  var params = this.params;
  var hitNewVec = hitNew.subtract(params.center).unit();
  var hitOldVec = hitOld.subtract(params.center).unit();
  var axis = hitNewVec.cross(hitOldVec).toArray();
  var angle = Math.acos(hitNewVec.dot(hitOldVec))*180.0/Math.PI;

  var m = GL.Matrix.rotate(-angle, axis[0], axis[1], axis[2]); 
  params.rotation = params.rotation.multiply(m);
  this.trackball.rotation = params.rotation;
};

CloudViewer.prototype.panWorldXY = function(x, y, dx, dy) {
  var tracer = new GL.Raytracer();
  var viewplane = utils.getViewPlane(this.params.center);
  var viewpoint = tracer.eye;

  var oldRay = tracer.getRayForPixel(x-dx, y-dy);
  var oldHitplane = utils.intersectionLinePlane(viewplane, oldRay, viewpoint);
  var newRay = tracer.getRayForPixel(x, y);
  var newHitplane = utils.intersectionLinePlane(viewplane, newRay, viewpoint);

  var diff = oldHitplane.subtract(newHitplane);
  this.params.center = this.params.center.add(diff);
};

CloudViewer.prototype.createBuffer = function(array, spacing) {
  var gl = this.gl;
  var buffer = gl.createBuffer();
  buffer.length = array.length;
  buffer.spacing = spacing;
  gl.bindBuffer (gl.ARRAY_BUFFER, buffer);
  gl.bufferData (gl.ARRAY_BUFFER, array, gl.STATIC_DRAW); 
  return buffer;
};

CloudViewer.prototype.fetchCameras = function(start, allDoneCallback, callbackArgs) {
  var cv = this;
  var params = this.params;
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
      cv.cameras.push(GL.Mesh.bundlerCameras(data['cameras']));
      if (start + num < params.camCount) {
        cv.fetchCameras(start+num, allDoneCallback, callbackArgs);
      } else {
        if (allDoneCallback) {
          allDoneCallback.apply(this, callbackArgs);
        }
      }
    });
};

CloudViewer.prototype.fetchParticles = function(chunkId, allDoneCallback, callbackArgs) {
  var cv = this;
  var params = this.params;

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
      var clusterIdArray = floatArray.subarray(8*chunkSize, 9*chunkSize);
      var clusterColorArray = floatArray.subarray(9*chunkSize, 10*chunkSize);
      var idxArray = floatArray.subarray(10*chunkSize, floatArray.length);
      var posBuffer = cv.createBuffer(posArray, 3);
      var colorBuffer = cv.createBuffer(colorArray, 3);
      var timeBuffer = cv.createBuffer(timeArray, 2);
      var clusterIdBuffer = cv.createBuffer(clusterIdArray, 1);
      var clusterColorBuffer = cv.createBuffer(clusterColorArray, 1);
      var idxBuffer = cv.createBuffer(idxArray, 1);
      var ps = new GL.Mesh({triangles:false, colors:true});
      ps.vertexBuffers['gl_Vertex'].buffer = posBuffer;
      ps.vertexBuffers['gl_Color'].buffer = colorBuffer;
      ps.addVertexBuffer('times', 't_range');
      ps.vertexBuffers['t_range'].buffer = timeBuffer;
      ps.addVertexBuffer('clusterIds', 'clusterId');
      ps.vertexBuffers['clusterId'].buffer = clusterIdBuffer;
      ps.addVertexBuffer('clusterColors', 'clusterColor');
      ps.vertexBuffers['clusterColor'].buffer = clusterColorBuffer;
      ps.addVertexBuffer('idxs', 'idx');
      ps.vertexBuffers['idx'].buffer = idxBuffer;
      cv.particleSystem.push(ps);

      cv.glInvalidate = true;
      if (chunkId < params.chunkCount-1) {
        cv.fetchParticles(chunkId+1, allDoneCallback, callbackArgs);
      } else {
        if (allDoneCallback) {
          allDoneCallback.apply(this, callbackArgs);
        }
      }
    }
  };
  xhr.send(null);
};

CloudViewer.prototype.getInfo = function() {
  var cv = this;
  var params = this.params;
  $.getJSON('api/getInfo?dataset='+params.dataset, function(data) {
    params.time = (data.tmin + data.tmax) / 2;
    params.tmax = data.tmax;
    params.tmin = data.tmin;
    params.camCount = 0;//data.camCount;
    params.ptCount = data.ptCount;
    params.chunkCount = data.chunkCount;
    params.chunkSize = data.chunkSize;

    // setup gui control
    $('#current_time').text(utils.unixTimeToHumanDateStr(params.time));
    $('#time_seekbar')
      .attr('max', data.tmax)
      .attr('min', data.tmin)
      .change(function(e) {
        params.time = parseFloat($(this).val());
        $('#current_time').text(utils.unixTimeToHumanDateStr(params.time));
        cv.glInvalidate = true;
      })
      .mousemove(function(e) {
        var offset = e.offsetX;
        var min = parseInt($(this).attr('min'));
        var timespan = parseInt($(this).attr('max')) - min;
        var width = this.clientWidth;
        var sw = 20;  // slider thumb width
        var sw2 = sw/2;
        var date = Math.floor((Math.min(Math.max(sw2, e.offsetX), width-sw2)-sw2) / (width-sw) * timespan) + min;
        $('#time_tooltip').text(utils.unixTimeToHumanDateStr(date));
        var widthOffset = $('#time_tooltip')[0].clientWidth / 2;
        $('#time_tooltip').css('left', e.clientX-widthOffset+'px');
      })
      .val(params.time);

    // now get all the cameras then points
    cv.fetchCameras(0, cv.fetchParticles, [0, function() {
      $('#loading_text').hide();
    }]);
  });
};

