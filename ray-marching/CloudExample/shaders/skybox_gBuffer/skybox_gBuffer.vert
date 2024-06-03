#version 460

uniform mat4 PVM;
uniform vec4 CAM_POS;

in vec4 position;

out Data {
    vec4 localPos;
} Outputs;

void main() {
    Outputs.localPos = position;
    gl_Position = PVM * vec4(vec3(position + CAM_POS), 1.0);
}