var PlyLoader = function(content) {
  this.headerContent = null;
  this.bodyContent = null;
  this.header = {
    vertex: {
      properties: [],
      count: 0
    },
    fileformat: 'ascii',
  };
  this.parse(content);
};

PlyLoader.prototype.parse = function(content) {
  var headbodySplits = content.split("end_header\n");
  if (headbodySplits.length < 1) {
    alert('invalid ply file format');
    return;
  }

  this.headerContent = headbodySplits[0].split("\n");
  this.bodyContent = headbodySplits[1];
  this.parseHeader();
  this.parseBody();
};

PlyLoader.prototype.parseHeader = function() {
  var formatPattern = /^format (ascii|binary_little_endian|binary_big_endian).*/;
  var elementPattern = /element (\w*) (\d*)/;
  var propertyPattern = /property (char|uchar|short|ushort|int|uint|float|double) (\w*)/;

  while (this.headerContent.length > 0) {
    var line = this.headerContent.shift();

    if (line === 'ply') {
      //console.log(line);
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
};

PlyLoader.prototype.parseBody = function() {
  var cv = cloudViewer;

  var worker = new Worker('static/js/parsebodyworker.js');
  worker.addEventListener('message', function(e) {
    var data = e.data;

    if (data.status == 'update') {

      // reflect the progress on the UI
      var val = Math.floor(data.update * 80) + 20;
      $('#loader_progress').attr('value', val);

    } else if (data.status == 'done') {

      $('#loader_progress').hide();
      cv.particlePositions = data.pos;

      // construct VBO from array buffer
      var posBuffer = cv.createBuffer(data.pos, 3);
      var colorBuffer = cv.createBuffer(data.color, 3);
      var idxBuffer = cv.createBuffer(data.idx, 1);
      var ps = new GL.Mesh({triangles:false, colors:true});
      ps.vertexBuffers['gl_Vertex'].buffer = posBuffer;
      ps.vertexBuffers['gl_Color'].buffer = colorBuffer;
      ps.addVertexBuffer('idxs', 'idx');
      ps.vertexBuffers['idx'].buffer = idxBuffer;
      cv.particleSystem = [];
      cv.particleSystem.push(ps);
      cv.glInvalidate = true;

      // cleanup
      this.headerContent = null;
      this.bodyContent = null;

    }
  }, false);

  worker.postMessage(this);
};
