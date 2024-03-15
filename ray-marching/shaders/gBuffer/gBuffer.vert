#version 460

uniform mat4 PVM, M;
uniform mat3 NORMAL_MAT;

in vec4 position;
in vec2 texCoord0;
in vec4 normal;

out Data {
    vec3 normal;
    vec4 position;
    vec2 texCoord;
} Outputs;

void main() {
    Outputs.normal = normalize(NORMAL_MAT * vec3(normal));
    Outputs.position = M * position;
    Outputs.texCoord = texCoord0;

    Outputs.position /= Outputs.position.w;
    
    gl_Position = PVM * position;
}