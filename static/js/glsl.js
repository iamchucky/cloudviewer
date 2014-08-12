var glsl = {

  particle: { 
    vertex: '\
      uniform float filterTime;\
      uniform float far;\
      uniform float near;\
      uniform float size;\
      uniform float round;\
      uniform float currentTime;\
      varying vec4 color;\
      varying float rounded_points;\
      attribute vec2 time;\
      attribute vec2 filteredTime;\
      void main() {\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
        gl_PointSize = min(8.0, size / -cameraSpace.z);\
        color = gl_Color;\
        rounded_points = round;\
        vec2 selected_time = filterTime > 0.5 ? filteredTime : time;\
        if ((!(0.0 <= selected_time.x) && !(0.0 <= selected_time.y)) || (currentTime < selected_time.x || currentTime > selected_time.y)) {\
          gl_Position = vec4(99999, 99999, 99999, 1);\
        }\
      }'
    , 
    fragment: '\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        if (rounded_points == 1.0) {\
          vec2 m = vec2(2.0*(gl_PointCoord.x - 0.5), 2.0*(gl_PointCoord.y - 0.5));\
          float a = m.x * m.x;\
          float b = m.y * m.y;\
          if (1.0-a-b < 0.0) {\
            discard;\
          }\
        }\
        gl_FragColor = color;\
      }'
  },

  pointId: {
    vertex: '\
      attribute vec2 t_range;\
      attribute float idx;\
      uniform float baseIndex;\
      uniform float size;\
      uniform float round;\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
        vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
        gl_PointSize = min(8.0, size / -cameraSpace.z);\
        float newIndex = idx + baseIndex;\
        float idx0 = floor(newIndex/16777216.0)/255.0;\
        float idx1 = floor(mod(newIndex, 16777216.0)/65536.0)/255.0;\
        float idx2 = floor(mod(newIndex, 65536.0)/256.0)/255.0;\
        float idx3 = mod(newIndex, 256.0)/255.0;\
        color = vec4(idx0, idx1, idx2, idx3);\
        rounded_points = round;\
      }',
    fragment: '\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        if (rounded_points == 1.0) {\
          vec2 m = vec2(2.0*(gl_PointCoord.x - 0.5), 2.0*(gl_PointCoord.y - 0.5));\
          float a = m.x * m.x;\
          float b = m.y * m.y;\
          if (1.0-a-b < 0.0) {\
            discard;\
          }\
        }\
        gl_FragColor = color;\
      }'
  }

}
