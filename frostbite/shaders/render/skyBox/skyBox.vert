#version 430

uniform mat4 P, V, M;
uniform vec4 CAM_POS;

in vec4 position;

out Data {
    vec4 localPos;
    vec4 worldPos;
} DataOut;

void main() {
    DataOut.localPos = position;
    DataOut.worldPos = M * vec4(vec3(position + CAM_POS), 1.0);
    gl_Position = P * V * DataOut.worldPos;
}
