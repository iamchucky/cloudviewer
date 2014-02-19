var glsl = {

  particle: { 
    vertex: '\
      attribute vec2 t_range;\
      attribute float clusterId;\
      attribute float clusterColor;\
      uniform float time;\
      uniform float far;\
      uniform float near;\
      uniform float size;\
      uniform float round;\
      uniform float cluster1;\
      uniform float cluster2;\
      uniform float clusterColor1;\
      uniform float clusterColor2;\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        if (t_range[0] <= time && t_range[1] >= time) {\
          gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
          vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
          gl_PointSize = min(8.0, max(2.0, size / -cameraSpace.z));\
          if (cluster1 != -1.0 && cluster2 != -1.0) {\
            float cColor;\
            if (clusterId == cluster1) {\
              cColor = clusterColor1;\
            } else if (clusterId == cluster2) {\
              cColor = clusterColor2;\
            } else {\
              cColor = clusterColor;\
            }\
            float idx1 = floor(mod(cColor, 16777216.0)/65536.0)/255.0;\
            float idx2 = floor(mod(cColor, 65536.0)/256.0)/255.0;\
            float idx3 = mod(cColor, 256.0)/255.0;\
            color = vec4(idx1, idx2, idx3, 1.0);\
          } else {\
            color = gl_Color;\
          }\
          rounded_points = round;\
        } else {\
          gl_PointSize = 0.0;\
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

  camera: {
    vertex: '\
      void main() {\
        gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
      }'
    ,
    fragment: '\
      void main() {\
        gl_FragColor = vec4(0.5, 0.25, 0.5, 1.0);\
      }'
  },

  pointId: {
    vertex: '\
      attribute vec2 t_range;\
      attribute float idx;\
      uniform float time;\
      uniform float size;\
      uniform float round;\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        if (t_range[0] <= time && t_range[1] >= time) {\
          gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
          vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
          gl_PointSize = min(8.0, max(2.0, size / -cameraSpace.z));\
          float idx0 = floor(idx/16777216.0)/255.0;\
          float idx1 = floor(mod(idx, 16777216.0)/65536.0)/255.0;\
          float idx2 = floor(mod(idx, 65536.0)/256.0)/255.0;\
          float idx3 = mod(idx, 256.0)/255.0;\
          color = vec4(idx0, idx1, idx2, idx3);\
          rounded_points = round;\
        } else {\
          gl_PointSize = 0.0;\
        }\
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
  },

  clusterId: {
    vertex: '\
      attribute vec2 t_range;\
      attribute float clusterId;\
      uniform float time;\
      uniform float size;\
      uniform float round;\
      varying vec4 color;\
      varying float rounded_points;\
      void main() {\
        if (t_range[0] <= time && t_range[1] >= time) {\
          gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
          vec4 cameraSpace = gl_ModelViewMatrix * gl_Vertex;\
          gl_PointSize = min(8.0, max(2.0, size / -cameraSpace.z));\
          float idx1 = floor(mod(clusterId, 16777216.0)/65536.0)/255.0;\
          float idx2 = floor(mod(clusterId, 65536.0)/256.0)/255.0;\
          float idx3 = mod(clusterId, 256.0)/255.0;\
          color = vec4(idx1, idx2, idx3, 1.0);\
          rounded_points = round;\
        } else {\
          gl_PointSize = 0.0;\
        }\
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
