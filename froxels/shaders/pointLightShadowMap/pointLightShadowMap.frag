#version 460

in vec4 FragPos;

uniform vec4 LIGHT_POS;
uniform float CM_FAR;

out float depth;

void main() {
    float lightDist = length(FragPos.xyz - LIGHT_POS.xyz);

    depth = lightDist / CM_FAR;
}