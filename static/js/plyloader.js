var PlyLoader = function(content) {
  this.header = null;
  this.body = null;
  this.vertex = {
    properties: [],
    count: 0
  };
  this.parse(content);
};

PlyLoader.prototype.parse = function(content) {
  var headbodySplits = content.split("end_header\n");
  if (headbodySplits.length < 1) {
    alert('invalid ply file format');
    return;
  }

  this.header = headbodySplits[0].split("\n");
  this.body = headbodySplits[1].split("\n");
  this.parseHeader();
  this.parseBody();
};

PlyLoader.prototype.parseHeader = function() {
  var formatPattern = /^format (ascii|binary_little_endian).*/;
  var elementPattern = /element (\w*) (\d*)/;
  var propertyPattern = /property (char|uchar|short|ushort|int|uint|float|double) (\w*)/;

  while (this.header.length > 0) {
    var line = this.header.shift();

    if (line === 'ply') {
      console.log(line);
    } else if (line.search(formatPattern) >= 0) {
      var result = line.match(formatPattern);
      console.log('fileformat: '+result[1]);
    } else if (line.search(elementPattern) >= 0) {
      var result = line.match(elementPattern);
      var name = result[1];

      if (name !== 'vertex') {
        continue;
      }
      this.vertex.count = parseInt(result[2]);

      while (this.header[0].search(propertyPattern) >= 0) {
        var result = this.header.shift().match(propertyPattern);
        var type = result[1];
        var name = result[2];
        this.vertex.properties.push({type: type, name: name});
      }
      break;
    }
  }
};

PlyLoader.prototype.parseBody = function() {
  var cv = cloudViewer;

  var worker = new Worker('static/js/parsebody.js');
  worker.addEventListener('message', function(e) {
    var data = e.data;

    if (data.status == 'update') {
      var val = Math.floor(data.update * 100);
      $('#loader_progress').show();
      $('#loader_progress').attr('value', val);
    } else if (data.status == 'done') {
      $('#loader_progress').hide();
      cv.particlePositions = data.pos;
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
      this.header = null;
      this.body = null;
    }
  }, false);

  worker.postMessage(this);
};
