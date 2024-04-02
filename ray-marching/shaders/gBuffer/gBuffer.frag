#version 460

uniform sampler2D TEX_UNIT;

in Data {
    vec3 normal;
    vec4 position;
    vec2 texCoord;
} Inputs;

layout (location = 0) out vec4 normal;
layout (location = 1) out vec4 position;
layout (location = 2) out vec4 albedo;
layout (location = 3) out vec4 skyboxFlag;

void main() {
    normal = vec4(normalize(Inputs.normal) * 0.5 + 0.5, 1.0);
    position = Inputs.position;
    albedo = texture(TEX_UNIT, Inputs.texCoord);
    skyboxFlag = vec4(0.0);
}