#version 300 es

precision highp float;

uniform vec2 resolution;

uniform float viewYaw;
uniform float viewPitch;
uniform float viewFov;
uniform float brushSize;
uniform vec3 brushColor;
uniform vec2 lineStart;
uniform vec2 lineEnd;
uniform float clear;

uniform sampler2D previousFrame;

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

float sdLine(vec2 start, vec2 end, vec2 uv)
{
	vec2 line = end - start;
	float frac = dot(uv - start,line) / dot(line,line);
	return distance(start + line * clamp(frac, 0.0, 1.0), uv);
}

void main(void) 
{
    vec2 uv = gl_FragCoord.xy / resolution;
    vec4 col = texture(previousFrame,vec2(uv.x,1.0-uv.y),0.0);
    vec2 aspect = vec2(1920,1080)/1080.0;

    vec2 ang = (uv-0.5)*vec2(2.0*PI,PI);
    vec3 dir = vec3(sin(ang.x),sin(ang.y),cos(ang.x));
    dir.xz *= cos(ang.y);

    float focalLen = 1.0/tan(0.5*viewFov*PI/180.0);
    vec3 maskDir = dir;
    maskDir = rotateY(maskDir, radians(-viewYaw));
    maskDir = rotateX(maskDir, radians(viewPitch));
    maskDir = normalize(maskDir/vec3(1,1,focalLen));

    vec2 maskUV = vec2(atan(maskDir.x,maskDir.z), atan(maskDir.y,length(maskDir.xz)));
    maskUV = fract(maskUV/vec2(PI/2.0,PI/2.0) + 0.5);
    maskUV = vec2(0.5*maskDir.xy/maskDir.z+0.5);

    vec2 texUV = vec2(atan(dir.x,dir.z), atan(dir.y,length(dir.xz)));
    texUV = fract(texUV/vec2(2.0*PI,PI) + 0.5);

    vec2 p0 = (vec2(lineStart.x, 1.0-lineStart.y)-0.5)*aspect + 0.5;
    float d = sdLine(p0, p0, maskUV);
    d -= 0.01;
    d = smoothstep(1./256., 0.0, d) * float(maskDir.z > 0.0);

    col = mix(col, vec4(brushColor,1), d);
    col = mix(col, vec4(0,0,0,1), clear);

    fragColor = vec4(col.rgb,1.0);  
}
