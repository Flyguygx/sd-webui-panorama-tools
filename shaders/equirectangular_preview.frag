#version 300 es

precision highp float;

uniform vec2 resolution;
uniform float pitch;
uniform float yaw;
uniform float fov;

uniform float maskYaw;
uniform float maskPitch;
uniform float maskFov;
uniform float maskBlend;
uniform float maskEnable;

uniform float reorientYaw;
uniform float reorientPitch;
uniform float offsetTop;
uniform float offsetBottom;

uniform sampler2D equirectangular;
uniform sampler2D inpainting;

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

vec4 samplePanorama(sampler2D tex, vec2 uv, float offsetTop, float offsetBottom)
{
    uv.y = (uv.y-offsetBottom) / (1.0-offsetTop-offsetBottom);
    uv.y = clamp(uv.y,0.0,1.0);
    uv.y = 1.0 - uv.y;
    
    if(uv.y == 0.0 || uv.y == 1.0)
    {
        //Use lower resolution mip-map outside image bounds for average color.
        return texture(tex,uv,8.0); 
    }
    else
    {
        return texture(tex,uv,0.0);
    }
}

void main(void) 
{
    vec2 uv = gl_FragCoord.xy / resolution;

    vec2 ang = (uv-0.5)*vec2(2.0*PI,PI);
    vec3 dir = vec3(sin(ang.x),sin(ang.y),cos(ang.x));
    dir.xz *= cos(ang.y);

    float focalLen = 1.0/tan(0.5*maskFov*PI/180.0);
    vec3 maskDir = dir;
    maskDir = rotateY(maskDir, radians(-maskYaw));
    maskDir = rotateX(maskDir, radians(maskPitch));
    maskDir = normalize(maskDir/vec3(1,1,focalLen));

    vec2 maskUV = vec2(atan(maskDir.x,maskDir.z), atan(maskDir.y,length(maskDir.xz)));
    maskUV = fract(maskUV/vec2(PI/2.0,PI/2.0) + 0.5);
    maskUV = vec2(0.5*maskDir.xy/maskDir.z+0.5);

    float clip = 0.0;
    if(maskEnable != 0.0)
    {
        clip = float((maskDir.z>abs(maskDir.x)) && (maskDir.z>abs(maskDir.y)));
        if(maskBlend != 0.0)
        {
            clip *= smoothstep(1.0,1.0-maskBlend,abs(maskDir.x)/maskDir.z);
            clip *= smoothstep(1.0,1.0-maskBlend,abs(maskDir.y)/maskDir.z);
        }
    }

    dir = rotateX(dir, radians(reorientPitch));
    dir = rotateY(dir, radians(reorientYaw));

    vec2 texUV = vec2(atan(dir.x,dir.z), atan(dir.y,length(dir.xz)));
    texUV = fract(texUV/vec2(2.0*PI,PI) + 0.5);

    vec4 col = samplePanorama(equirectangular,texUV, offsetTop, offsetBottom);
    vec4 fill = samplePanorama(inpainting,maskUV, 0.0, 0.0);
    col = mix(col,fill,clip);

    fragColor = vec4(col.rgb,1.0);  
}
