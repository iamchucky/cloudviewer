var Parameters = function() {
  this.cameraZ = 10.0;
  this.rotation = GL.Matrix.identity();
  this.center = new GL.Vector(0, 0, 0);
  this.near = 0.5;
  this.far = 2500.0;
  this.pointSize = 1.0;
  this.resetTrackball = function() {
    cloudViewer.trackball.invRotation = cloudViewer.params.rotation.inverse();
  };
  this.showFps = true;
  this.roundPoints = true;
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
  this.trackball = null;
  this.stats = null;
  this.shaders = null;;

  this.particleSystem = [];
  this.particlePositions = null;
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

    var pos = cv.particlePositions.subarray(pointId*3, pointId*3+3);
    params.center = new GL.Vector(pos[0], pos[1], pos[2]);
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
  gl.animate();
  //gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  cv.glInvalidate = true;
};

CloudViewer.prototype.setupShaders = function() {
  // Define all shaders
  this.shaders = {
    pointId: new GL.Shader(glsl.pointId.vertex, glsl.pointId.fragment),
    particle: new GL.Shader(glsl.particle.vertex, glsl.particle.fragment)
  };
};

CloudViewer.prototype.setupUI = function() {
  var cv = this;
  var params = this.params;

  // init stats
  /*var stats = new Stats();
  $('#top_container')[0].appendChild( stats.domElement );
  this.stats = stats;*/

  this.setupDatGui();

  document.addEventListener('dragenter', function(e) {
    e.stopPropagation();
    e.preventDefault();

    $('#canvas').css('opacity', '0.1');
  }, false);
  document.addEventListener('dragleave', function(e) {
    e.stopPropagation();
    e.preventDefault();
    $('#canvas').css('opacity', '1');
  }, false);
  document.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, false);
  document.addEventListener('drop', function(e) {
    e.stopPropagation();
    e.preventDefault();

    $('#canvas').css('opacity', '1');

    var files = e.dataTransfer.files;
    for (var i = 0, f; f = files[i]; i++) {
      cv.readPly(f);
    }
  }, false);

  $('#ply_url').on('keyup', function(e) {
    if (e.keyCode == 13) {
      var url = $(this).val();
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function(e) {
        $('#ply_url').val('');
        var bb = new Blob([this.response]);
        bb.name = url;
        cv.readPly(bb);
      };
      xhr.onprogress = function(e) {
        if (e.lengthComputable) {
          $('#loader_progress').show();
          var percentLoaded = Math.round((e.loaded / e.total) * 20);
          $('#loader_progress').attr('value', percentLoaded);
        } else {
          $('#ply_url').val('File is big, downloading...');
        }
      };
      xhr.send();
    }
  });
};

CloudViewer.prototype.readPly = function(file) {
  var reader = new FileReader();
  reader.onload = function(theFile) {
    return function(e) {
      var name = theFile.name;
      console.log(name + ' loaded');
      var loader = new PlyLoader(e.target.result);
    };
  }(file);
  reader.onprogress = function(e) {
    if (e.lengthComputable) {
      $('#loader_progress').show();
      var percentLoaded = Math.round((e.loaded / e.total) * 20);
      $('#loader_progress').attr('value', percentLoaded);
    }
  };
  reader.readAsBinaryString(file);
};

CloudViewer.prototype.setupDatGui = function() {
  var cv = this;
  var params = this.params;
  var gl = this.gl;
  var gui = new dat.GUI();

  var cameraFolder = gui.addFolder('Camera');
  cv.guiZoom = cameraFolder.add(params, 'cameraZ', 1.0, 2048.0)
    .name('camera z')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  cameraFolder.add(params, 'near', 0.1, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    cv.glInvalidate = true;
  });
  cameraFolder.add(params, 'far', 1.0, 2500.0).onFinishChange(function() {
    gl.setNearFar(params.near, params.far);
    cv.glInvalidate = true;
  });
  cv.guiPointSize = cameraFolder.add(params, 'pointSize', 1.0, 512.0)
    .name('point size')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  cameraFolder.open();

  gui.add(params, 'resetTrackball')
    .name('reset trackball')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
  /*
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
    */
  this.gui = gui;
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
    round: params.roundPoints ? 1.0 : 0.0,
    size: params.pointSize,
    near: params.near, 
    far: params.far 
  };
  for (var i = 0; i < this.particleSystem.length; i++) {
    shader.uniforms(uniforms)
      .draw(this.particleSystem[i], this.gl.POINTS);
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

