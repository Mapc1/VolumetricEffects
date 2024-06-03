#version 460

// GBuffer
uniform sampler2D POSITION;
uniform sampler2D ALBEDO;
uniform sampler2D SCATTERING;
uniform sampler2D TRANSMITTANCE;

// Other props
uniform float FAR;
uniform mat4 V,M;

const float GAMMA = 2.2;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

vec3 toneMap(vec3 color, float gamma) {
    vec3 tone_mapped = color / (color + vec3(1.0));
    return pow(tone_mapped, vec3(1.0 / gamma));
}

void main() {
    vec4 world_position = texture(POSITION, Inputs.texCoord);
    if (world_position == vec4(0.0))
        discard;

    vec4 albedo = texture(ALBEDO, Inputs.texCoord);

    vec4 color = albedo;
    
    vec3 scattering = texture(SCATTERING, Inputs.texCoord).rgb;
    float transmittance = texture(TRANSMITTANCE, Inputs.texCoord).r;

    scattering = toneMap(scattering, GAMMA);

    color.rgb = color.rgb * transmittance + scattering;

    FragColor = color;
}