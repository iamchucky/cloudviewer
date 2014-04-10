var PlyLoader = function(content, onerror) {
  this.headerContent = null;
  this.bodyContent = null;
  this.workerContent = null;
  this.header = {
    vertex: {
      properties: [],
      count: 0
    },
    fileformat: '',
    ply: false,
  };
  this.geometry = null;
  this.onerror = onerror;
  this.parse(content);
};

PlyLoader.prototype.parse = function(content) {
  var headbodySplits = content.split("end_header\n");
  if (headbodySplits.length != 2) {
    this.onerror();
    return;
  }

  this.headerContent = headbodySplits[0].split("\n");
  this.bodyContent = headbodySplits[1];
  var isvalid = this.parseHeader();
  if (isvalid) {
    this.parseBody();
  } else {
    this.onerror();
  }
};

PlyLoader.prototype.parseHeader = function() {
  var formatPattern = /^format (ascii|binary_little_endian|binary_big_endian).*/;
  var elementPattern = /element (\w*) (\d*)/;
  var propertyPattern = /property (char|uchar|short|ushort|int|uint|float|double) (\w*)/;

  while (this.headerContent.length > 0) {
    var line = this.headerContent.shift();

    if (line === 'ply') {
      //console.log(line);
      this.header.ply = true;
    } else if (line.search(formatPattern) >= 0) {
      var result = line.match(formatPattern);
      var fileformat = result[1]
      this.header.fileformat = fileformat;

      console.log('fileformat: '+result[1]);
    } else if (line.search(elementPattern) >= 0) {
      var result = line.match(elementPattern);
      var name = result[1];

      // this app only cares about vertex
      if (name !== 'vertex') {
        continue;
      }
      this.header.vertex.count = parseInt(result[2]);

      while (this.headerContent[0].search(propertyPattern) >= 0) {
        var result = this.headerContent.shift().match(propertyPattern);
        var type = result[1];
        var name = result[2];
        this.header.vertex.properties.push({type: type, name: name});
      }
      break;
    }
  }
  var isvalid = this.header.ply && this.header.fileformat && this.header.vertex.count;
  return isvalid;
};

PlyLoader.prototype.parseBody = function() {
  var cv = cloudViewer;
  var loader = this;
  this.geometry = new THREE.BufferGeometry();
  this.geometry.addAttribute('position', Float32Array, this.header.vertex.count, 3);
  this.geometry.addAttribute('color', Float32Array, this.header.vertex.count, 3);
  this.geometry.addAttribute('idx', Float32Array, this.header.vertex.count, 1);
  this.workerContent = {
    fileformat: this.header.fileformat,
    vertex: this.header.vertex,
    body: this.bodyContent
  };

  var worker = new Worker('static/js/parsebodyworker.js');
  worker.addEventListener('message', function(e) {
    var data = e.data;

    if (data.status == 'update') {

      // reflect the progress on the UI
      var val = Math.floor(data.update * 80) + 20;
      $('#loader_progress').attr('value', val);

    } else if (data.status == 'error') {

      // reflect to UI if error when parsing
      loader.onerror(data.message);

    } else if (data.status == 'done') {

      $('#loader_progress').hide();
      cv.particlePositions = data.pos;

      loader.geometry.attributes.position.array = data.pos;
      loader.geometry.attributes.color.array = data.color;
      loader.geometry.attributes.idx.array = data.idx;

      if (cv.particleSystem) {
        cv.scene.remove(cv.particleSystem);
      }
      cv.particleSystem = new THREE.ParticleSystem(loader.geometry, cv.material);
      cv.scene.add(cv.particleSystem);
      cv.glInvalidate = true;

      // cleanup
      this.headerContent = null;
      this.bodyContent = null;

    }
  }, false);

  worker.postMessage(this.workerContent);
};
