#version 300 es

in vec4 coordinates; 

void main() 
{
    gl_Position = coordinates;
}