#version 460

// Directional light props
uniform vec4 DIRECT_LIGHT_COLOR;
uniform float AMBIENT_LIGHT_STRENGTH;
uniform float DIRECT_LIGHT_INTENSITY;
uniform bool DIRECT_LIGHT_ENABLED;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;


// GBuffer
uniform sampler2D POSITION;
uniform sampler2D NORMAL;
uniform sampler2D ALBEDO;
uniform sampler2D POINT_LIGHT_ILUMINATION;
uniform sampler2D SCATTERING;
uniform sampler2D TRANSMITTANCE;
uniform sampler2D SKYBOX_FLAG;

// Other props
uniform float FAR;
uniform mat4 V,M;

const float GAMMA = 2.2;

in Data {
    vec2 texCoord;
    vec3 lightDir;
} Inputs;

out vec4 FragColor;

float directLightLuminance(vec3 normal, vec3 lightDir, vec4 world_pos) {
    // If the surface is facing away from the light we don't add any illumination
    float n_dot_l = max(0.0, dot(normal, lightDir));

    float shadow = 0.0;
    vec4 light_space_coord = DIRECT_LIGHT_SPACE_MAT * world_pos;
    light_space_coord.z -= 0.0005;

    vec2 texel_size = 1.0 / textureSize(DIRECT_LIGHT_SHADOW_MAP, 0);
    for (int x = -1; x < 1; x++) {
        for (int y = -1; y < 1; y++) {
            vec4 offset = vec4(vec2(x,y) * texel_size, 0, 0);
            shadow += textureProj(DIRECT_LIGHT_SHADOW_MAP, light_space_coord + offset);
        }
    }

    return n_dot_l * (shadow/9) * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH;
}

vec4 toneMap(vec4 color, float gamma) {
    vec4 tone_mapped = color / (color + vec4(1.0));
    return tone_mapped; //pow(tone_mapped, vec4(1.0 / gamma));
}

void main() {
    vec4 world_position = texture(POSITION, Inputs.texCoord);
    if (world_position == vec4(0.0))
        discard;

    vec3 normal = normalize(texture(NORMAL, Inputs.texCoord).xyz * 2 - 1);
    vec4 albedo = texture(ALBEDO, Inputs.texCoord);
    vec3 light_dir = normalize(Inputs.lightDir);
    float skybox_flag = texture(SKYBOX_FLAG, Inputs.texCoord).r;


    vec4 color = vec4(0.0,0.0,0.0,1.0);
    if (skybox_flag < 1.0) {
        // Directional light lighting
        if (DIRECT_LIGHT_ENABLED) {
            float luminance = directLightLuminance(normal, light_dir, world_position);
            color += albedo * DIRECT_LIGHT_COLOR * luminance * DIRECT_LIGHT_INTENSITY;
        }

        vec4 ilumination = texture(POINT_LIGHT_ILUMINATION, Inputs.texCoord);
        color += ilumination;
    }

    vec3 scattering = texture(SCATTERING, Inputs.texCoord).rgb;
    float transmittance = texture(TRANSMITTANCE, Inputs.texCoord).r;

    color.rgb = color.rgb * transmittance + scattering;

    FragColor = toneMap(color, GAMMA);
}