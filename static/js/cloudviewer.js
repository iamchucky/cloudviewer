var Parameters = function() {
  this.near = 0.001;
  this.far = 2500.0;
  this.pointSize = 0.01;
  this.fogDensity = 0.001;
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
  this.particleSystem = null;

  this.gl = null;
  this.guiPointSize = null;
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
  console.log(this.isMobile);

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
  this.controls.keys = [0, 0, 0];
  this.controls.addEventListener('change', this.render);

  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(0x333333, params.fogDensity);

  this.material = new THREE.ParticleSystemMaterial({ size: params.pointSize, vertexColors: true});

  this.setupEventListeners();
};

CloudViewer.prototype.setupEventListeners = function() {
  var cv = this;
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

    cv.material.showidx = 0;
    if (pointId == 0) {
      return;
    }

    var pos = cv.particlePositions.subarray(pointId*3, pointId*3+3);
    var newTarget = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var v = new THREE.Vector3();
    v.subVectors(newTarget, cv.controls.target);

    cv.camera.position.addVectors(cv.camera.position, v);
    cv.controls.target = newTarget;
    cv.glInvalidate = true;
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
    cv.glInvalidate = true;
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

  this.canvas.addEventListener('touchmove', function(e) {
    cv.glInvalidate = true;
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

      $('#zoom_btn').css('top', '150px');
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
    cv.controls.zoomDelta(0.1);
    cv.glInvalidate = true;
    zoomInterval = setInterval(function() {
      cv.controls.zoomDelta(0.1);
      cv.glInvalidate = true;
    }, 50);
  });
  $('#mini_btn_zoomin').on('mouseup', function(e) {
    window.clearInterval(zoomInterval);
    cv.glInvalidate = true;
  });
  $('#mini_btn_zoomout').on('mousedown', function(e) {
    cv.controls.zoomDelta(-0.1);
    cv.glInvalidate = true;
    zoomInterval = setInterval(function() {
      cv.controls.zoomDelta(-0.1);
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

      var loader = new PlyLoader(binary, function(str) {
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
  cv.guiPointSize = gui.add(params, 'pointSize', 0.0001, 0.05)
    .name('point size')
    .onChange(function(val) {
      cv.material.size = val;
      cv.glInvalidate = true;
    });
  gui.add(params, 'fogDensity', 0.00025, 0.003)
    .name('fog density')
    .onChange(function(val) {
      cv.scene.fog.density = val;
      cv.glInvalidate = true;
    });
};

CloudViewer.prototype.renderIdMap = function() {
  var gl = this.renderer.getContext();
  gl.clearColor(0, 0, 0, 0);
  gl.colorMask(true, true, true, true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  this.material.showidx = 1.0;
  this.renderer.render(this.scene, this.camera);
};

CloudViewer.prototype.sampleIdMap = function(x, y, width, height) {
  var gl = this.renderer.getContext();
  var pixels = new Uint8Array(4);
  gl.readPixels(x,height-y,1,1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  var pointId = pixels[0]*16777216 + pixels[1]*65536 + pixels[2]*256 + pixels[3];
  return pointId;
};

CloudViewer.prototype.fitAll = function(medoid, distToCenter) {
  var fromTargetToMedoid = new THREE.Vector3();
  fromTargetToMedoid.subVectors(medoid, this.controls.target);
  this.camera.position.addVectors(this.camera.position, fromTargetToMedoid);
  this.controls.target = medoid;

  var zoomDist = new THREE.Vector3();
  zoomDist.subVectors(this.camera.position, this.controls.target);
  zoomDist.setLength(distToCenter);
  this.camera.position.addVectors(zoomDist, this.controls.target);

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
  var medoid = new THREE.Vector3(pos[medoidIdx*3], pos[medoidIdx*3+1], pos[medoidIdx*3+2]);

  // find the top 90%
  function compareDist(a, b) {
    return a.dist - b.dist;
  }
  var sortedDistJ = minDistJ.sort(compareDist);

  var rank = Math.round(0.9 * numSamples + 0.5);
  var distToCenter = Math.sqrt(sortedDistJ[rank].dist) / Math.sin( Math.PI / 180.0 * this.camera.fov * 0.5 );

  return {medoid: medoid, dist: distToCenter};
};
