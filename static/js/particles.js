
function BillboardSystem(options, particles) {
    options = options || {};
    options.color = 1;
    this.mesh = new Mesh(options);

    var i = 0;
    for (var particle in particles) {
        mesh.vertices.push(particle.position);
        mesh.colors.push(particle.color);
        mesh.triangles.push([i++]);
    }
    mesh.compile();
    return mesh;
}

