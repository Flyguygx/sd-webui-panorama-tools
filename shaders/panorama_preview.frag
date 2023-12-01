#version 300 es

precision highp float;

uniform vec2 resolution;
uniform float pitch;
uniform float yaw;
uniform float fov;
uniform float referenceEnable;
uniform sampler2D equirectangular;
uniform sampler2D reference;

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
    vec2 aspect = resolution.xy/resolution.y;
    vec2 uv = gl_FragCoord.xy / resolution.y;

    float focalLen = 1.0/tan(0.5*fov*PI/180.0);
    vec3 dir = normalize(vec3(2.0*(uv-aspect/2.0), focalLen));
    dir = rotateX(dir, radians(-pitch));
    dir = rotateY(dir, radians(yaw));

    vec2 texUV = vec2(atan(dir.x,dir.z), atan(dir.y,length(dir.xz)));
    texUV = fract(texUV/vec2(2.0*PI,PI) + 0.5);
    texUV.y = 1.0-texUV.y;

    vec4 col = texture(equirectangular, texUV, 0.0);

    if(referenceEnable != 0.0)
    {
        vec4 refCol = texture(reference, texUV, 0.0);

        float avgCol = (col.r+col.g+col.b)/3.0;
        float refAvgCol = (refCol.r+refCol.g+refCol.b)/3.0;

        if(refAvgCol > avgCol)
        {
            col = refCol;
        }
    }

    fragColor = vec4(col.rgb,1.0); 
}