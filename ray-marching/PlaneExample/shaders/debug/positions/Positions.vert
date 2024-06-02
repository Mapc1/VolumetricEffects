#version 460

in vec4 position;
in vec2 texCoord0;

out Data {
    vec2 texCoord;
} Outputs;

void main() {
    Outputs.texCoord = texCoord0;

    gl_Position = position;
}