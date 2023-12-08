#version 430

uniform mat4 P, V, M;
uniform vec4 CAM_POS;

in vec4 position;

out Data {
    vec4 localPos;
} DataOut;

void main() {
    DataOut.localPos = position;
    gl_Position = P * V * M * vec4(vec3(position + CAM_POS), 1.0);
}
