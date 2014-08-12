var Parameters = function() {
  this.cameraZ = 10.0;
  this.rotation = GL.Matrix.identity();
  this.center = new GL.Vector(0, 0, 0);
  this.currentTime = 1367737200.0;
  this.filterTime = true;
  this.near = 0.001;
  this.far = 2500.0;
  this.pointSize = 1.0;
  this.roundPoints = false;
};

var getUrlParams = function(key) {
  return (RegExp(key + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1];
}

var CloudViewer = function() {
  this.canvas = $('#canvas')[0];
  this.time_bar = $('#time_bar');

  this.gl = null;
  this.guiPointSize = null;
  this.current_time = null;
  this.glInvalidate = true;
  this.params = new Parameters();
  this.trackball = null;
  this.stats = null;
  this.shaders = null;;
  this.embeded = (window != window.top); // I'm in a iframe
  this.autoload = getUrlParams('autoload') == 'true';
  this.onloadUrl = getUrlParams('url');

  this.isMobile = (typeof window.orientation !== 'undefined');
  this.fullscreen = false;

  this.particleSystem = [];
  this.particlePositions = [];
};

CloudViewer.prototype.setupGL = function() {
  var params = this.params;

  // NOTE: need antialias:false so that readPixels works as expected.
  // need alpha:true to allow alpha channel working.
  this.gl = GL.create({
    antialias: false,
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: $('#canvas')[0]
  });
  var gl = this.gl;

  this.setupShaders();
  this.setupEventListeners();

  gl.fullscreen({providedCanvas: true, near: params.near, far: params.far, fov: 45});
  gl.animate();
  //gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  this.glInvalidate = true;
};

CloudViewer.prototype.setupEventListeners = function() {
  var cv = this;
  var gl = this.gl;
  var params = this.params;
  this.canvas.addEventListener('dblclick', function(e) {
    if (cv.isMobile) {
      return;
    }
    e.preventDefault();

    var x = e.clientX ? e.clientX : e.x;
    var y = e.clientY ? e.clientY : e.y;
    cv.renderIdMap();
    var pointId = cv.sampleIdMap(x, y, this.width, this.height);
    cv.glInvalidate = true;
    gl.ondraw();

    if (pointId == 0) {
      return;
    }

    var positions = null;
    for (var index = 0; index < cv.particlePositions.length; index++) {
      if (pointId > cv.particlePositions[index].length) {
        pointId -= cv.particlePositions[index].length;
      } else {
        positions = cv.particlePositions[index];
        break;
      }
    }
    var pos = positions.subarray(pointId*3, pointId*3+3);
    params.center = new GL.Vector(pos[0], pos[1], pos[2]);
    cv.glInvalidate = true;
    gl.ondraw();
  });

  var mousewheelevt=(/Firefox/i.test(navigator.userAgent))? 'DOMMouseScroll' : 'mousewheel';
  this.canvas.addEventListener(mousewheelevt, function(e) {
    var wheelDelta = e.wheelDeltaY | e.wheelDelta | e.detail*-1;
    if (e.altKey) {
      if (wheelDelta > 0) {
        params.pointSize *= 2.0;
      } else if (wheelDelta < 0) {
        params.pointSize /= 2.0;
      }
      params.pointSize = Math.min(512.0, Math.max(1.0, params.pointSize));
      if (cv.guiPointSize) {
        cv.guiPointSize.updateDisplay();
      }
    } else {
      if (wheelDelta > 0) {
        params.cameraZ /= 1.1;
      } else if (wheelDelta < 0) {
        params.cameraZ *= 1.1;
      }
      params.cameraZ = Math.min(10240.0, Math.max(0.1, params.cameraZ));
    }
    cv.glInvalidate = true;
    e.preventDefault();
  });

  gl.onmouseup = function(e) {
    $('#canvas').css('cursor', 'auto');
  };

  gl.onmousemove = function(e) {
    if (!e.dragging) {
      return;
    }
    if (e.ctrlKey || (!e.altKey && e.which == 3)) {
      // pan mode
      $('#canvas').css('cursor', 'move');
      cv.panWorldXY(e.x, e.y, e.deltaX, e.deltaY);
    } else if (e.altKey || e.which == 2) {
      // zoom mode
      if (e.deltaY < 0) {
        $('#canvas').css('cursor', '-webkit-zoom-in');
      } else {
        $('#canvas').css('cursor', '-webkit-zoom-out');
      }
      params.cameraZ += 150.0 * e.deltaY / gl.canvas.height;
      params.cameraZ = Math.min(10240.0, Math.max(0.1, params.cameraZ));
    } else {
      // sphere mode
      $('#canvas').css('cursor', '-webkit-grabbing');
      cv.rotateWorldWithSphere(e.x, e.y, e.deltaX, e.deltaY);
    }
    cv.glInvalidate = true;
  };

  gl.ontouchmove = function(e) {
    switch(e.touches.length) {
      case 1:
        // sphere
        cv.rotateWorldWithSphere(e.x, e.y, e.deltaX, e.deltaY);
        break;
      case 2:
        // zoom
        params.cameraZ -= 10.0* e.deltaZoom / gl.canvas.height;
        params.cameraZ = Math.min(10240.0, Math.max(0.1, params.cameraZ));
        break;
      case 3:
        // pan
        cv.panWorldXY(e.x, e.y, e.deltaX, e.deltaY);
        break;
      default:
        break;
    }
    cv.glInvalidate = true;
  };

  gl.ondraw = function() {
    // be sure to set glInvalidate to true to redraw
    if (!cv.glInvalidate) {
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

    cv.glInvalidate = false;
  }
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

  if (this.isMobile) {
    if (!this.embeded && !this.onloadUrl) {
      $('#title_block').css('margin', 'auto');
      $('#title_block').css('width', '75%');
      $('#title_block').css('position', 'initial');
      $('#ply_url').css('font-size', 'xx-large');
      $('#title').hide();
      $('#title_block').show();
      $('#drag_text').hide();
      $('#help').hide();
      this.setupPlyLoadFromUrl();
    } else {
      this.setupAutoload();
      $('#mini_title_block').show();
    }
    var fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
    if (fullscreenEnabled) {
      this.setupFullscreenHandlers();
    }
    Hammer($('#canvas')[0]).on('doubletap', function(e) {
      if (fullscreenEnabled) {
        if (cv.fullscreen) {
          cv.exitFullscreen();
        } else {
          cv.requestFullscreen($('#canvas')[0]);
        }
      }
    });
  } else {
    if (!this.embeded) {

      $('#title_block').show();
      this.setupDatGui();
      this.setupTimeBar();
      this.setupPlyDragAndDrop();
      this.setupPlyLoadFromUrl();

      // toggle on help icon for showing shortkey help
      $('#help').on('click', function(e) {
        if ($('#shortkey_help').attr('class')) {
          $('#shortkey_help').removeClass('hidden');
        } else {
          $('#shortkey_help').addClass('hidden');
        }
      });

      if (this.onloadUrl) {
        this.downloadPly(this.onloadUrl);
      }

      $('#zoom_btn').css('top', '120px');
      $('#zoom_btn').css('right', '15px');

      $('#dropzone').show();
    } else {
      this.setupEmbedUI();
      this.setupAutoload();
    }
    this.setupZoomButton();
  }
};

CloudViewer.prototype.setupZoomButton = function() {
  var cv = this;
  var zoomInterval = null;
  $('#zoom_btn').show();
  $('#mini_btn_zoomin').on('mousedown', function(e) {
    cv.params.cameraZ /= 1.1;
    cv.params.cameraZ = Math.min(10240.0, Math.max(0.1, cv.params.cameraZ));
    cv.glInvalidate = true;
    zoomInterval = setInterval(function() {
      cv.params.cameraZ /= 1.1;
      cv.params.cameraZ = Math.min(10240.0, Math.max(0.1, cv.params.cameraZ));
      cv.glInvalidate = true;
    }, 50);
  });
  $('#mini_btn_zoomin').on('mouseup', function(e) {
    window.clearInterval(zoomInterval);
    cv.glInvalidate = true;
  });
  $('#mini_btn_zoomout').on('mousedown', function(e) {
    cv.params.cameraZ *= 1.1;
    cv.params.cameraZ = Math.min(10240.0, Math.max(0.1, cv.params.cameraZ));
    cv.glInvalidate = true;
    zoomInterval = setInterval(function() {
      cv.params.cameraZ *= 1.1;
      cv.params.cameraZ = Math.min(10240.0, Math.max(0.1, cv.params.cameraZ));
      cv.glInvalidate = true;
    }, 50);
  });
  $('#mini_btn_zoomout').on('mouseup', function(e) {
    window.clearInterval(zoomInterval);
    cv.glInvalidate = true;
  });
}

CloudViewer.prototype.setupEmbedUI = function() {
  var cv = this;
  var params = this.params;
  $('#mini_ui').show();
  $('#mini_title_block').show();

  var fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
  if (fullscreenEnabled) {
    this.setupFullscreenHandlers();
  } else {
    $('#mini_btn_expand').hide();
    $('#mini_btn_compress').hide();
  }

  if (this.onloadUrl) {
    $('#mini_btn_download').on('click', function(e) {
      window.open(cv.onloadUrl);
    });
  }
};

CloudViewer.prototype.setupAutoload = function() {
  var cv = this;
  if (!this.autoload) {
    // show start loading UI
    $('#top_overlay').show();
    $('#start_loading').on('click', function(e) {
      $('#top_overlay').fadeOut();
      if (cv.onloadUrl) {
        cv.downloadPly(cv.onloadUrl);
      }
    });
    $('#start_download').on('click', function(e) {
      if (cv.onloadUrl) {
        window.open(cv.onloadUrl);
      }
    });
    $('#open_new').on('click', function(e) {
      if (cv.onloadUrl) {
        window.open('http://kmatzen.github.io/cloudviewer?autoload=true&url=' + cv.onloadUrl);
      }
    });
  } else if (this.onloadUrl) {
    this.downloadPly(this.onloadUrl);
  }
};

CloudViewer.prototype.setupFullscreenHandlers = function() {
  var cv = this;
  var fullscreenHandler = function(e) {
    var fullscreen = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    cv.fullscreen = fullscreen;
    if (fullscreen) {
      $('#mini_btn_expand').hide();
      $('#mini_btn_compress').show();
    } else {
      $('#mini_btn_compress').hide();
      $('#mini_btn_expand').show();
    }
    cv.glInvalidate = true;
  };
  document.addEventListener('fullscreenchange', fullscreenHandler);
  document.addEventListener('mozfullscreenchange', fullscreenHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenHandler);
  document.addEventListener('MSFullscreenChange', fullscreenHandler);
  $('#mini_btn_expand').on('click', function(e) {
    cv.requestFullscreen($('body')[0]);
  });
  $('#mini_btn_compress').on('click', function(e) {
    cv.exitFullscreen();
  });
};

CloudViewer.prototype.requestFullscreen = function(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
};

CloudViewer.prototype.exitFullscreen = function() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

CloudViewer.prototype.setupTimeBar = function() {
  var cv = this;
  var time_bar = cv.time_bar.slider({
    'min': 1104566400,
    'max': 1388563200,
    'value': 1367737200,
    'tooltip': 'show',
    'formater': function(timestamp) {
      var d = new Date(timestamp * 1000);
      return d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
    },
  });
  time_bar.on('slide', function (ev) {
    cv.current_time.setValue(ev.value);
  });
}

CloudViewer.prototype.setupPlyDragAndDrop = function() {
  var cv = this;
  var setForegroundOpacity = function (val) {
    $('.dg').css('opacity', val);
    $('#title_block').css('opacity', val);
    $('#canvas').css('opacity', val);
    $('#zoom_btn').css('opacity', val);
  };
  document.addEventListener('dragenter', function(e) {
    e.stopPropagation();
    e.preventDefault();
    setForegroundOpacity('0.1');
  }, false);
  document.addEventListener('dragleave', function(e) {
    e.stopPropagation();
    e.preventDefault();
    setForegroundOpacity('1');
  }, false);
  document.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    setForegroundOpacity('0.1');
  }, false);
  document.addEventListener('drop', function(e) {
    e.stopPropagation();
    e.preventDefault();

    $('#ply_url').blur();
    setForegroundOpacity('1');

    var files = e.dataTransfer.files;
    var callback = null;
    for (var i = 0, f; f = files[i]; i++) {
      callback = (function (file, c) { return function() { cv.readPly(file, c); } })(f, callback);
    }
    callback();
  }, false);
};

CloudViewer.prototype.setupPlyLoadFromUrl = function() {
  var cv = this;
  $('#ply_url').on('keyup', function(e) {
    if (e.keyCode == 13) {
      $('#ply_url').blur();

      // start fetching file from the URL
      var url = $(this).val();
      cv.downloadPly(url, '#ply_url');
    }
  });
  $('#ply_url').focus();
};

CloudViewer.prototype.downloadPly = function(url, elem) {
  var cv = this;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function(e) {
    $(elem).val('');

    // only load if the response is good
    if (xhr.status != 200) {
      alert('Error: URL provided is invalid');
      $(elem).focus();
      return;
    }

    var bb = new Blob([this.response]);
    bb.name = url;
    cv.readPly(bb);
  };
  xhr.onprogress = function(e) {
    if (xhr.status != 200) {
      return;
    }
    if (e.lengthComputable) {
      var percentLoaded = Math.round((e.loaded / e.total) * 20);
      $('#loader_progress').show();
      $('#loader_progress').attr('value', percentLoaded);
    } else {
      $(elem).val('File is big, downloading...');
    }
  };
  xhr.onerror = function(e) {
    $(elem).val('');
    alert('Error: URL provided is invalid');
    $(elem).focus();
  };
  xhr.send();
};

CloudViewer.prototype.readPly = function(file, callback) {
  var cv = this;
  var reader = new FileReader();
  reader.onload = function(theFile) {
    return function(e) {
      var name = theFile.name;
      var binary = '';
      if (reader.readAsBinaryString) {
        binary = e.target.result;
      } else {
        var bytes = new Uint8Array(e.target.result);
        for (var i = 0; i < bytes.byteLength; ++i) {
          binary += String.fromCharCode(bytes[i]);
        }
      }
      console.log(name + ' loaded');

      var loader = new PlyLoader(binary,
        function() {
          if (callback) {
            callback();
          }
        }, 
        function(str) {
          $('#loader_progress').hide();
          alert(str ? str : 'Invalid file format.');
        });
    };
  }(file);
  reader.onprogress = function(e) {
    if (e.lengthComputable) {
      var percentLoaded = Math.round((e.loaded / e.total) * 20);
      $('#loader_progress').show();
      $('#loader_progress').attr('value', percentLoaded);
    }
  };

  if (reader.readAsBinaryString) {
    reader.readAsBinaryString(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
};

CloudViewer.prototype.setupDatGui = function() {
  var cv = this;
  var params = this.params;
  var gl = this.gl;
  var gui = new dat.GUI();
  dat.GUI.toggleHide();

  gui.add(params, 'near', 0.001, 1.0).onChange(function() {
    cv.camera.near = params.near;
    cv.camera.updateProjectionMatrix();
    cv.glInvalidate = true;
  });
  gui.add(params, 'far', 1.0, 2500.0).onChange(function() {
    cv.camera.far = params.far;
    cv.camera.updateProjectionMatrix();
    cv.glInvalidate = true;
  });
  cv.current_time = gui.add(params, 'currentTime', 946713600.0, 1388563200.0)
    .name('current time')
    .onChange(function() {
      cv.time_bar.slider('setValue', params.currentTime); 
      cv.glInvalidate = true;
    });
  gui.add(params, 'filterTime', false)
    .name('filter time')
    .onChange(function() {
      cv.glInvalidate = true;
    });
  cv.guiPointSize = gui.add(params, 'pointSize', 1.0, 512.0)
    .name('point size')
    .onChange(function(val) {
      cv.glInvalidate = true;
    });
};

CloudViewer.prototype.renderIdMap = function() {
  var gl = this.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.colorMask(true, true, true, true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  this.renderScene(this.shaders.pointId);
};

CloudViewer.prototype.sampleIdMap = function(x, y, width, height) {
  var gl = this.gl;
  var pixels = new Uint8Array(4);
  gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  var pointId = pixels[0]*16777216 + pixels[1]*65536 + pixels[2]*256 + pixels[3];
  return pointId;
};

CloudViewer.prototype.renderScene = function(shader) {
  var baseIndex = 0;
  for (var index = 0; index < this.particleSystem.length; index++) {
    var params = this.params;
    var uniforms = {
      baseIndex: baseIndex,
      size: params.pointSize,
      near: params.near,
      far: params.far,
      currentTime: params.currentTime,
      filterTime: params.filterTime,
    };
    shader.uniforms(uniforms).draw(this.particleSystem[index], this.gl.POINTS);
    baseIndex += this.particlePositions[index].length;
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

CloudViewer.prototype.fitAll = function(medoid, distToCenter) {
  this.params.center = medoid;
  this.params.cameraZ = distToCenter;

  this.glInvalidate = true;
};

CloudViewer.prototype.findMedoidAndDist = function(idx, pos) {
  // find 100 random samples
  var samples = [];
  var numSamples = 100;
  // if not enough points, return
  if (idx.length < 100) {
    return {medoid: null, dist: 10};
  }

  for (var i = 0; i < numSamples; ++i) {
    samples.push(idx[Math.floor(Math.random()*idx.length)]);
  }

  // find the medoid out of the 100 samples
  var minDist = Number.MAX_VALUE;
  var medoidI = null;
  
  var minDistJ = null;
  for (var i = 0; i < numSamples; ++i) {
    var sumDist = 0;
    var idxI = samples[i];
    var spacingI = idxI * 3;
    var xI = pos[spacingI];
    var yI = pos[spacingI + 1];
    var zI = pos[spacingI + 2];
    var distJ = [];
    for (var j = 0; j < numSamples; ++j) {
      if (j == i) {
        continue;
      }

      // calculate norm then add to sum
      var idxJ = samples[j];
      var spacingJ = idxJ * 3;
      var xJ = pos[spacingJ];
      var yJ = pos[spacingJ + 1];
      var zJ = pos[spacingJ + 2];

      var dist = Math.pow(xI-xJ, 2) + Math.pow(yI-yJ, 2) + Math.pow(zI-zJ, 2);
      sumDist += dist;
      distJ.push({dist:dist, idx:idxJ});

      if (sumDist >= minDist) {
        break;
      }
    }
    if (sumDist < minDist) {
      minDist = sumDist;
      medoidI = i;
      minDistJ = distJ;
    }
  }

  var medoidIdx = samples[medoidI];
  var medoid = new GL.Vector(pos[medoidIdx*3], pos[medoidIdx*3+1], pos[medoidIdx*3+2]);

  // find the top 90%
  function compareDist(a, b) {
    return a.dist - b.dist;
  }
  var sortedDistJ = minDistJ.sort(compareDist);

  var rank = Math.round(0.9 * numSamples + 0.5);
  var distToCenter = Math.sqrt(sortedDistJ[rank].dist) / Math.sin( Math.PI / 180.0 * 45 * 0.5 ); // fov of 45

  return {medoid: medoid, dist: distToCenter};
};
