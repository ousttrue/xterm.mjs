uniform vec4 uCursorScreen;
uniform vec4 uRect;
out vec2 vUv;
out vec4 vColor;

bool isHover(vec4 rect, float x, float y)
{
    if(x<rect.x)return false;
    if(x>rect.x+rect.z)return false;
    if(y<rect.y)return false;
    if(y>rect.y+rect.w)return false;
    return true;
}

void main(){
  vUv = uv;
  float x=(uRect.x + position.x * uRect.z)/uCursorScreen.z;
  float y=(uRect.y + position.y * uRect.w)/uCursorScreen.w;
  gl_Position = vec4(
    x*2.0-1.0,
    (1.0-y)*2.0-1.0,
    0,
    1.0
  );
  vColor = isHover(uRect, uCursorScreen.x, uCursorScreen.y) ? vec4(1,0,0,1) : vec4(0,1,0,1);
}

