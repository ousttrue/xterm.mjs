in vec2 vUv;
in vec4 vColor;
uniform sampler2D uTexture;
out highp vec4 FragColor;

void main( void ) {
  vec4 t = texture2D(uTexture, vUv);
  FragColor = t;
  // FragColor = vec4(vUv, 0, 1);
  // FragColor = vColor;
}

