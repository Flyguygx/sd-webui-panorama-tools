#version 300 es

precision highp float;

uniform vec2 resolution;
uniform float pitch;
uniform float yaw;
uniform float zoom;
uniform sampler2D equirectangular;

const float PI = 3.1415926535;

out vec4 fragColor;

vec3 rotateX(vec3 p, float a) 
{
    float c = cos(a), s = sin(a);
    return vec3(
        p.x,
        c*p.y-s*p.z,
        s*p.y+c*p.z
    );
}

vec3 rotateY(vec3 p, float a) 
{
    float c = cos(a), s = sin(a);
    return vec3(
        c*p.x+s*p.z,
        p.y,
        -s*p.x+c*p.z
    );
}

void main(void) 
{
    vec2 uv = gl_FragCoord.xy / resolution;

    vec3 dir = normalize(vec3(2.0*uv-1.0, zoom));
    dir = rotateX(dir, radians(pitch));
    dir = rotateY(dir, radians(yaw));

    vec2 texUV = vec2(atan(dir.x,dir.z), atan(dir.y,length(dir.xz)));
    texUV = fract(texUV/vec2(2.0*PI,PI) + 0.5);
    texUV.y = 1.0-texUV.y;

    vec4 col = texture(equirectangular, texUV,0.0);

    fragColor = vec4(col.rgb,1.0); 
}