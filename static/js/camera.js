var addCameraToMesh = function(mesh, pos, fov, lookat, up) {
    var w = 512, h = 512;
    var viewport = [0, 0, w, h];
    var projection = GL.Matrix.perspective(fov, 1, 0.25, 1);
    var modelView = GL.Matrix.lookAt(pos.x, pos.y, pos.z, 
            lookat.x, lookat.y, lookat.z, 
            up.x, up.y, up.z);

    var eye = modelView.inverse().transformPoint(new GL.Vector());
    var unproject = function(x, y, z) {
        var point = new GL.Vector(
                (x - viewport[0]) / viewport[2] * 2 - 1,
                (y - viewport[1]) / viewport[3] * 2 - 1,
                z * 2 - 1
                );
        var tempMatrix = new GL.Matrix();
        var resultMatrix = new GL.Matrix();
        return GL.Matrix.inverse(GL.Matrix.multiply(projection, modelView, tempMatrix), resultMatrix).transformPoint(point);
    };
    var corners = [unproject(0, 0, 0),
        unproject(w, 0, 0),
        unproject(0, h, 0),
        unproject(w, h, 0),
        unproject(0, 0, 1),
        unproject(w, 0, 1),
        unproject(0, h, 1),
        unproject(w, h, 1),
        eye];

    var vertices = [];
    for (var i = 0; i < corners.length; i++)
        vertices.push(corners[i].toArray());

    var lines = [];
    for (var i = 0; i < 8; i++) {
        if (i < 4) {
            lines.push(8);
            lines.push(i);
        }
        for (var j = 0; j < 3; j++) {
            lines.push(i);
            lines.push(i ^ (1 << j));
        }
    }
    for (var i = 0; i < lines.length; i++) {
        lines[i] += mesh.vertices.length;
    }

    mesh.vertices = mesh.vertices.concat(vertices);
    mesh.lines = mesh.lines.concat(lines);
};

GL.Mesh.camera = function(pos, fov, lookat, up, options) {
    options = options || {};
    options['triangles'] = false;
    options['lines'] = true;
    var mesh = new GL.Mesh(options);
    addCameraToMesh(mesh, pos, fov, lookat, up);
    mesh.compile();
    return mesh;
};

GL.Mesh.bundlerCameras = function(camerasJson, options) {
    options = options || {};
    options['triangles'] = false;
    options['lines'] = true;
    var mesh = new GL.Mesh(options);
    for (var i = 0; i < camerasJson.length; i++) {
        c = camerasJson[i];
        var R = new GL.Matrix(
                c.R11, c.R12, c.R13, 0,
                c.R21, c.R22, c.R23, 0,
                c.R31, c.R32, c.R33, 0,
                0, 0, 0, 1);
        var t = new GL.Vector(c.t1, c.t2, c.t3);
        var Rt = R.transpose();
        pos = Rt.transformPoint(t).multiply(-1);
        lookat = Rt.transformPoint(new GL.Vector(0, 0, -1));
        up = Rt.transformPoint(new GL.Vector(0, 1, 0));
        fov = 20;
        addCameraToMesh(mesh, pos, fov, lookat, up);
    }
    mesh.compile();
    return mesh;
};

GL.Mesh.bundlerCamera = function(f, k1, k2, R, t, options) {
    options = options || {};
    options['triangles'] = false;
    options['lines'] = true;
    var mesh = new GL.Mesh(options);
    var pos, fov, lookat, up;
    var Rt = R.transpose();
    pos = Rt.transformPoint(t).multiply(-1);
    lookat = Rt.transformPoint(new GL.Vector(0, 0, -1));
    up = Rt.transformPoint(new GL.Vector(0, 1, 0));
    fov = 20;
    addCameraToMesh(mesh, pos, fov, lookat, up);
    mesh.compile();
    return mesh;
};
