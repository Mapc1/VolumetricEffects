#version 430

in vec4 position;

uniform mat4 PVM;

void main() {
    gl_Position = PVM * position;
}