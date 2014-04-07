var utils = {

  getUrlParams: function(key) {
    return (RegExp(key + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1];
  },

  unixTimeToHumanDate: function(timestamp) {
    var date = new Date(timestamp * 1000),
        dateVals = [
          date.getFullYear(),
          (date.getMonth()+1).padLeft(2),
          date.getDate().padLeft(2)];
    return dateVals;
  },

  unixTimeToHumanDateStr: function(timestamp) {
    return this.unixTimeToHumanDate(timestamp).join('/');
  },

  hitHyper: function(center, radius, viewpoint, viewplane, hitplane) {
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
  },

  getViewPlane: function(center) {
    var tracer = new GL.Raytracer();

    var viewpoint = tracer.eye;
    var plnorm = viewpoint.subtract(center);
    plnorm = plnorm.unit();
    var ploffset = plnorm.dot(center);
    return {normal: plnorm, offset: ploffset};
  },

  intersectionLinePlane: function(plane, line, lineOrigin) {
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
  }

};
