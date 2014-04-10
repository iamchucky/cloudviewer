var Parameters = function() {
  this.cameraZ = 10.0;
  this.near = 0.5;
  this.far = 2500.0;
  this.pointSize = 0.01;
  this.roundPoints = false;
};

var getUrlParams = function(key) {
  return (RegExp(key + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1];
}

var CloudViewer = function() {
  this.canvas = $('#canvas')[0];
  this.camera = null;
  this.controls = null;
  this.scene = null;
  this.renderer = null;
  this.mesh = null;
  this.particleSystem = null;

  this.gl = null;
  this.guiZoom = null;
  this.guiPointSize = null;
  this.glInvalidate = true;
  this.enable_glInvalidate = true;
  this.params = new Parameters();
  this.trackball = null;
  this.stats = null;
  this.shaders = null;;
  this.embeded = (window != window.top); // I'm in a iframe
  this.autoload = getUrlParams('autoload') == 'true';
  this.onloadUrl = getUrlParams('url');

  this.particlePositions = null;
};

CloudViewer.prototype.setupGL = function() {
  var params = this.params;

  // NOTE: need antialias:false so that readPixels works as expected.
  // need alpha:true to allow alpha channel working.
  this.renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: $('#canvas')[0]
  });
  this.renderer.setClearColor(0x000000, 0);
  this.renderer.setSize(window.innerWidth, window.innerHeight);

  this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, params.near, params.far);
  this.camera.position.z = 10;

  this.controls = new THREE.TrackballControls(this.camera, this.canvas);
  this.controls.rotateSpeed = 1.0;
  this.controls.zoomSpeed = 1.2;
  this.controls.panSpeed = 0.8;
  this.controls.noZoom = false;
  this.controls.noPan = false;
  this.controls.staticMoving = true;
  this.controls.dynamicDampingFactor = 0.3;
  this.controls.keys = [0, 18, 17];
  this.controls.addEventListener('change', this.render);

  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(0x333333, 0.002);

  this.material = new THREE.ParticleSystemMaterial({ size: params.pointSize, vertexColors: true});

  this.setupEventListeners();
};

CloudViewer.prototype.setupEventListeners = function() {
  var cv = this;
  var params = this.params;
  this.canvas.addEventListener('dblclick', function(e) {
    e.preventDefault();

    /*cv.renderIdMap(cv.shaders.pointId);
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
    gl.ondraw();*/
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
      params.pointSize = Math.min(0.05, Math.max(0.0001, params.pointSize));
      cv.material.size = params.pointSize;
      if (cv.guiPointSize) {
        cv.guiPointSize.updateDisplay();
      }
    }
    e.preventDefault();
  });

  this.canvas.addEventListener('mouseup', function(e) {
    $('#canvas').css('cursor', 'auto');
  });

  this.canvas.addEventListener('mousedown', function(e) {
    var self = this;
    document.onmousemove = function(e) {
      if (e.ctrlKey || (!e.altKey && e.which == 3)) {
        // pan mode
        $('#canvas').css('cursor', 'move');
      } else if (e.altKey || e.which == 2) {
        // zoom mode
        $('#canvas').css('cursor', '-webkit-zoom-in');
      } else {
        // sphere mode
        $('#canvas').css('cursor', '-webkit-grabbing');
      }
      cv.glInvalidate = true;
    };

    this.onmouseup = function() {
      document.onmousemove = null;
    };
  });
};

CloudViewer.prototype.render = function() {
  var cv = cloudViewer;
  cv.renderer.render(cv.scene, cv.camera);
  //cv.stats.update();
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

  if (!this.embeded) {

    $('#title_block').show();
    this.setupDatGui();
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

  } else {
    $('#dropzone').hide();
    this.setupEmbedUI();
  }
};

CloudViewer.prototype.setupEmbedUI = function() {
  var cv = this;
  var params = this.params;
  $('#mini_ui').show();

  var fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled;
  if (fullscreenEnabled) {
    this.setupFullscreenHandlers();
  } else {
    $('#mini_btn_expand').hide();
    $('#mini_btn_compress').hide();
  }

  var zoomInterval = null;
  $('#mini_btn_zoomin').on('mousedown', function(e) {
    cv.controls.zoomDelta(0.1);
    zoomInterval = setInterval(function() {
      cv.controls.zoomDelta(0.1);
    }, 50);
    cv.glInvalidate = true;
  });
  $('#mini_btn_zoomin').on('mouseup', function(e) {
    window.clearInterval(zoomInterval);
    cv.glInvalidate = true;
  });
  $('#mini_btn_zoomout').on('mousedown', function(e) {
    cv.controls.zoomDelta(-0.1);
    zoomInterval = setInterval(function() {
      cv.controls.zoomDelta(-0.1);
    }, 50);
    cv.glInvalidate = true;
  });
  $('#mini_btn_zoomout').on('mouseup', function(e) {
    window.clearInterval(zoomInterval);
    cv.glInvalidate = true;
  });


  if (this.onloadUrl) {
    $('#mini_btn_download').on('click', function(e) {
      window.open(cv.onloadUrl);
    });
  }

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
        window.open('http://kmatzen.github.io/cloudviewer?url=' + cv.onloadUrl);
      }
    });
  } else if (this.onloadUrl) {
    this.downloadPly(this.onloadUrl);
  }
};

CloudViewer.prototype.setupFullscreenHandlers = function() {
  var cv = this;
  var fullscreenHandler = function(e) {
    var fullscreen = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
    if (fullscreen) {
      $('#mini_btn_expand').hide();
      $('#mini_btn_compress').show();
    } else {
      $('#mini_btn_compress').hide();
      $('#mini_btn_expand').show();
    }
  };
  document.addEventListener('fullscreenchange', fullscreenHandler);
  document.addEventListener('mozfullscreenchange', fullscreenHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenHandler);
  document.addEventListener('msfullscreenchange', fullscreenHandler);
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
  } else if (msRequestFullscreen) {
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
  }
}

CloudViewer.prototype.setupPlyDragAndDrop = function() {
  var cv = this;
  document.addEventListener('dragenter', function(e) {
    e.stopPropagation();
    e.preventDefault();

    $('.dg').css('opacity', '0.1');
    $('#title_block').css('opacity', '0.1');
    $('#canvas').css('opacity', '0.1');
  }, false);
  document.addEventListener('dragleave', function(e) {
    e.stopPropagation();
    e.preventDefault();
    $('.dg').css('opacity', '1');
    $('#title_block').css('opacity', '1');
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

    $('#ply_url').blur();
    $('.dg').css('opacity', '1');
    $('#title_block').css('opacity', '1');
    $('#canvas').css('opacity', '1');

    var files = e.dataTransfer.files;
    for (var i = 0, f; f = files[i]; i++) {
      cv.readPly(f);
      break;
    }
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

CloudViewer.prototype.readPly = function(file) {
  var reader = new FileReader();
  reader.onload = function(theFile) {
    return function(e) {
      var name = theFile.name;
      console.log(name + ' loaded');
      var loader = new PlyLoader(e.target.result, function(str) {
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
  reader.readAsBinaryString(file);
};

CloudViewer.prototype.setupDatGui = function() {
  var cv = this;
  var params = this.params;
  var gl = this.gl;
  var gui = new dat.GUI();

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
  cv.guiPointSize = gui.add(params, 'pointSize', 0.0001, 0.05)
    .name('point size')
    .onChange(function(val) {
      cv.material.size = val;
      cv.glInvalidate = true;
    });

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
