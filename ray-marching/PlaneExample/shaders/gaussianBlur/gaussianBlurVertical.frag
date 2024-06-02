#version 460

uniform sampler2D SCATTERING;
uniform sampler2D TRANSMITTANCE;

const float weights[5] = {
    0.227027,
    0.1945946,
    0.1216216,
    0.054054,
    0.016216
};

in Data {
    vec2 texCoord;
} Inputs;

layout (location = 0) out vec4 blurred_scattering;
layout (location = 1) out vec4 blurred_transmittance;

void main() {
    vec2 tex_coord = Inputs.texCoord;

    vec2 texel_size = 1 / textureSize(SCATTERING, 0);

    vec4 result_1 = texture(SCATTERING, tex_coord) * weights[0];

    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,1)) * weights[1];
    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,1)) * weights[1];

    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,2)) * weights[2];
    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,2)) * weights[2];

    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,3)) * weights[3];
    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,3)) * weights[3];

    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,4)) * weights[4];
    result_1 += textureOffset(SCATTERING, tex_coord, ivec2(0,4)) * weights[4];

    blurred_scattering = result_1;

    vec4 result_2 = texture(TRANSMITTANCE, tex_coord) * weights[0];

    result_2 += texture(TRANSMITTANCE, tex_coord + vec2(0,1) * texel_size) * weights[1];
    result_2 += texture(TRANSMITTANCE, tex_coord - vec2(0,1) * texel_size) * weights[1];

    result_2 += texture(TRANSMITTANCE, tex_coord + vec2(0,2) * texel_size) * weights[2];
    result_2 += texture(TRANSMITTANCE, tex_coord - vec2(0,2) * texel_size) * weights[2];

    result_2 += texture(TRANSMITTANCE, tex_coord + vec2(0,3) * texel_size) * weights[3];
    result_2 += texture(TRANSMITTANCE, tex_coord - vec2(0,3) * texel_size) * weights[3];

    result_2 += texture(TRANSMITTANCE, tex_coord + vec2(0,4) * texel_size) * weights[4];
    result_2 += texture(TRANSMITTANCE, tex_coord - vec2(0,4) * texel_size) * weights[4];

    blurred_transmittance = result_2;
}