self.importScripts('DataStream.js');
self.addEventListener('message', function(e) {

  var fileformat = e.data.header.fileformat;
  var v = e.data.header.vertex;
  var body = e.data.bodyContent;
  var vcount = v.count;
  var vprops = v.properties;
  var vpropsLength = vprops.length;

  var step = vcount / 50; 
  var nextStep = step;

  var posArray = new Float32Array(v.count * 3);
  var colorArray = new Float32Array(v.count * 3);
  var idxArray = new Float32Array(v.count);

  // set color to white initially
  for (var i = 0; i < vcount*3; ++i) {
    colorArray[i] = 1.0;
  }

  // handle the body according to the fileformat
  if (fileformat == 'ascii') {
    body = body.split("\n");
  } else if (fileformat == 'binary_little_endian') {
    body = new DataStream(str2ab(body), 0, DataStream.LITTLE_ENDIAN);
  } else if (fileformat == 'binary_big_endian') {
    body = new DataStream(str2ab(body), 0, DataStream.BIG_ENDIAN);
  }

  // iterate through vertices to parse each value
  for (var j = 0; j < vcount; ++j) {
    var split = '';
    if (fileformat == 'ascii') {
      split = body[j].split(' ');
    }
    
    for (var i = 0; i < vpropsLength; ++i) {
      var prop = vprops[i].name;
      if (prop != 'x' && prop != 'y' && prop != 'z' &&
          prop != 'red' && prop != 'green' && prop != 'blue' &&
          prop != 'diffuse_red' && prop != 'diffuse_green' && prop != 'diffuse_blue' &&
          fileformat == 'ascii') {
        continue;
      }

      var val = 1.0;
      if (fileformat == 'ascii') {
        val = parseFloat(split[i]);
      } else {
        if (vprops[i].type == 'float') {
          val = body.readFloat32();
        } else if (vprops[i].type == 'uchar') {
          val = body.readUint8();
        }
      }

      // set position and color array
      if (prop == 'x') {
        posArray[j * 3] = val;
      } else if (prop == 'y') {
        posArray[j * 3 + 1] = val;
      } else if (prop == 'z') {
        posArray[j * 3 + 2] = val;
      } else if (prop == 'red' || prop == 'diffuse_red') {
        colorArray[j * 3] = val / (vprops[i].type == 'uchar' ? 256.0 : 1.0);
      } else if (prop == 'green' || prop == 'diffuse_green') {
        colorArray[j * 3 + 1] = val / (vprops[i].type == 'uchar' ? 256.0 : 1.0);
      } else if (prop == 'blue' || prop == 'diffuse_blue') {
        colorArray[j * 3 + 2] = val / (vprops[i].type == 'uchar' ? 256.0 : 1.0);
      }
    }
    // set idx array
    idxArray[j] = j;

    // update progress
    var progress = j / vcount;
    if (j > nextStep) {
      self.postMessage({status: 'update', update: progress});
      nextStep += step;
    }
  }

  // done, post result
  self.postMessage({status: 'done', pos: posArray, color: colorArray, idx: idxArray});
  colorArray = null;
  idxArray = null;

}, false);

var str2ab = function(str) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  var strLen = str.length;
  for (var i = 0; i < strLen; ++i) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};
