#version 460

uniform mat4 M;
uniform float FAR;
uniform vec4 CAM_POS;

uniform samplerCube CUBEMAP;

in Data {
    vec4 localPos;
} Inputs;

layout (location = 1) out vec4 position;
layout (location = 2) out vec4 albedo;
layout (location = 3) out vec4 skyboxFlag;

void main() {
    vec4 ray_dir = normalize(vec4(Inputs.localPos.xyz,0.0));
    position = CAM_POS + (ray_dir * FAR);
    albedo = texture(CUBEMAP, normalize(Inputs.localPos.xyz));
    skyboxFlag = vec4(1.0);
}