Mesh.camera = function(pos, lookat, up, options) {
    options['triangles'] = false;
    options['lines'] = true;
    var mesh = new Mesh(options);

    var w = 512, h = 512;
    var viewport = [0, 0, w, h];
    var projection = Matrix.perspective(fov, aspect, near, far);
    var modelView = Matrix.lookAt(pos.x, pos.y, pos.z, 
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
        unproject(w, h, 1)];

    for (var i = 0; i < 8; i++) {
        if (i < 4) {
            mesh.lines.push(eye);
            mesh.lines.push(corners[i]);
        }
        for (var j = 0; j < 3; j++) {
            mesh.lines.push(corners[i]);
            mesh.lines.push(corners[i ^ (1 << j)]);
        }
    }

    mesh.compile();
    return mesh;
};
