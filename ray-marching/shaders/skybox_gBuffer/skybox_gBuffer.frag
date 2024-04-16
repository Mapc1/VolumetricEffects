#version 460

uniform mat4 M;
uniform float FAR;
uniform vec4 CAM_POS;
uniform int SKYBOX_FAR;

in Data {
    vec4 localPos;
} Inputs;

layout (location = 1) out vec4 position;
layout (location = 3) out vec4 skyboxFlag;

void main() {
    vec4 ray_dir = normalize(vec4(Inputs.localPos.xyz,0.0));
    // Reduced far to increase performance
    position = CAM_POS + (ray_dir * SKYBOX_FAR);
    skyboxFlag = vec4(1.0);
}