GL.Mesh.camera = function(gl, pos, fov, lookat, up, options) {
    options = options || {};
    options['triangles'] = false;
    options['lines'] = true;
    var mesh = new GL.Mesh(options);

    var w = 512, h = 512;
    var viewport = [0, 0, w, h];
    var projection = GL.Matrix.perspective(fov, 1, 1, 5);
    var modelView = GL.Matrix.lookAt(pos.x, pos.y, pos.z, 
            lookat.x, lookat.y, lookat.z, 
            up.x, up.y, up.z);

    var eye = modelView.inverse().transformPoint(new GL.Vector());
    var unproject = function(x, y, z) {
        return gl.unProject(x, y, z, modelView, projection, viewport);
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
    for (var i = 0; i < corners.length; i++)
        mesh.vertices.push(corners[i].toArray());

    for (var i = 0; i < 8; i++) {
        if (i < 4) {
            mesh.lines.push(8);
            mesh.lines.push(i);
        }
        for (var j = 0; j < 3; j++) {
            mesh.lines.push(i);
            mesh.lines.push(i ^ (1 << j));
        }
    }

    mesh.compile();
    return mesh;
};

GL.Mesh.bundlerCamera = function(gl, f, k1, k2, R, t, options) {
    var pos, fov, lookat, up;
    var Rt = R.transpose();
    pos = Rt.transformPoint(t).multiply(-1);
    lookat = Rt.transformPoint(new GL.Vector(0, 0, -1));
    up = Rt.transformPoint(new GL.Vector(0, 1, 0));
    fov = 30;
    return new GL.Mesh.camera(gl, pos, fov, lookat, up, options);
};
