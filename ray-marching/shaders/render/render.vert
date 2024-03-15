#version 460

uniform mat4 V;
uniform vec4 LIGHT_DIR;

in vec4 position;
in vec2 texCoord0;

out Data {
    vec2 texCoord;
    vec3 lightDir;
} Outputs;

void main() {
    Outputs.texCoord = texCoord0;
    Outputs.lightDir = normalize(vec3(V * -LIGHT_DIR));

    gl_Position = position;
}