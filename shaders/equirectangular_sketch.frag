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
uniform float drawing;
uniform vec2 viewResolution;

uniform sampler2D previousFrame;

const float PI = 3.1415926535;
const float MAX_BRUSH_RADIUS = 0.125;
const vec4 CLEAR_COLOR = vec4(0,0,0,1);

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

//Distance from point "uv" to a  line segment
float distanceToLine(vec2 start, vec2 end, vec2 uv)
{
	vec2 line = end - start;
	float frac = dot(uv - start,line) / dot(line,line);
	return distance(start + line * clamp(frac, 0.0, 1.0), uv);
}

void main(void) 
{
    vec2 uv = gl_FragCoord.xy / resolution;
    vec4 col = texture(previousFrame,vec2(uv.x,1.0-uv.y),0.0);
    vec2 aspect = viewResolution/viewResolution.y;

    if(drawing != 0.0)
    {
        vec2 ang = (uv-0.5)*vec2(2.0*PI,PI);
        float focalLen = 1.0/tan(0.5*viewFov*PI/180.0);
        vec3 viewDir = vec3(sin(ang.x),sin(ang.y),cos(ang.x));

        viewDir.xz *= cos(ang.y);
        viewDir = rotateY(viewDir, radians(-viewYaw));
        viewDir = rotateX(viewDir, radians(viewPitch));
        viewDir = normalize(viewDir/vec3(1,1,focalLen));

        vec2 viewUV = vec2(atan(viewDir.x,viewDir.z), atan(viewDir.y,length(viewDir.xz)));
        viewUV = fract(viewUV/vec2(PI/2.0,PI/2.0) + 0.5);
        viewUV = vec2(0.5*viewDir.xy/viewDir.z+0.5);

        vec2 p0 = (vec2(lineStart.x, 1.0-lineStart.y)-0.5)*aspect + 0.5;
        vec2 p1 = (vec2(lineEnd.x, 1.0-lineEnd.y)-0.5)*aspect + 0.5;

        float dist = distanceToLine(p0, p1, viewUV);

        dist = 1.0 - step(brushSize * MAX_BRUSH_RADIUS, dist); //Line thickness
        dist *= float(viewDir.z > 0.0); //Clip area behind camera

        col = mix(col, vec4(brushColor, 1), dist);
    }

    if(clear != 0.0)
    {
        col = CLEAR_COLOR;
    }

    fragColor = vec4(col.rgb,1.0);  
}
