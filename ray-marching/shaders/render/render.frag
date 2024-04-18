#version 460

// Directional light props
uniform vec4 DIRECT_LIGHT_COLOR;
uniform float AMBIENT_LIGHT_STRENGTH;
uniform float DIRECT_LIGHT_INTENSITY;
uniform bool DIRECT_LIGHT_ENABLED;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

// Point light shadow maps
uniform samplerCube POINT_LIGHT_1_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_2_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_3_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_4_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_5_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_6_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_7_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_8_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_9_SHADOW_MAP;
uniform samplerCube POINT_LIGHT_10_SHADOW_MAP;

// GBuffer
uniform sampler2D POSITION;
uniform sampler2D NORMAL;
uniform sampler2D ALBEDO;
uniform sampler2D SCATTERING;
uniform sampler2D TRANSMITTANCE;
uniform sampler2D SKYBOX_FLAG;

// Other props
uniform float FAR;
uniform mat4 V,M;

const int NUM_LIGHTS = 10;
const float GAMMA = 2.2;

layout(std430, binding = 1) buffer Buff1 {
    vec4 positions[NUM_LIGHTS];
};
layout(std430, binding = 2) buffer Buff2 {
    vec4 colors[NUM_LIGHTS];
};
layout(std430, binding = 3) buffer Buff3 {
    float intensities[NUM_LIGHTS];
};
layout(std430, binding = 4) buffer Buff4 {
    float maxRanges[NUM_LIGHTS];
};
layout(std430, binding = 5) buffer Buff5 {
    bool enableds[NUM_LIGHTS];
};

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

float sampleCorrectShadowMap(int lightID, vec3 rayDir){
    switch (lightID) {
        case 0: 
            return texture(POINT_LIGHT_1_SHADOW_MAP, rayDir).r;
        case 1:
            return texture(POINT_LIGHT_2_SHADOW_MAP, rayDir).r;
        case 2:
            return texture(POINT_LIGHT_3_SHADOW_MAP, rayDir).r;
        case 3:
            return texture(POINT_LIGHT_4_SHADOW_MAP, rayDir).r;
        case 4:
            return texture(POINT_LIGHT_5_SHADOW_MAP, rayDir).r;
        case 5:
            return texture(POINT_LIGHT_6_SHADOW_MAP, rayDir).r;
        case 6:
            return texture(POINT_LIGHT_7_SHADOW_MAP, rayDir).r;
        case 7:
            return texture(POINT_LIGHT_8_SHADOW_MAP, rayDir).r;
        case 8:
            return texture(POINT_LIGHT_9_SHADOW_MAP, rayDir).r;
        case 9:
            return texture(POINT_LIGHT_10_SHADOW_MAP, rayDir).r;
        default:
            return 0.0;
    }
}

float pointLightLuminance(vec3 normal, vec4 worldPos, vec4 lightPos, float maxRange, int lightID) {
    vec3 frag_light_dir = (worldPos - lightPos).xyz;
    vec4 view_frag_light_dir = V * vec4(frag_light_dir,0.0);
    float n_dot_l = max(0.0, -dot(normalize(normal), normalize(view_frag_light_dir.xyz)));

    float current_depth = length(frag_light_dir);

    float closest_depth = sampleCorrectShadowMap(lightID, frag_light_dir);//texture(POINT_LIGHT_1_SHADOW_MAP, frag_light_dir).r;
    closest_depth *= FAR;

    float bias = 0.05;
    float shadow = current_depth - bias <= closest_depth ? 1.0 : 0.0;
    float luminance = n_dot_l * shadow * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH;

    float attenuation = max(0.0, (pow(maxRange, (maxRange-current_depth)/maxRange))/maxRange);

    return luminance * attenuation;
}

vec4 toneMap(vec4 color, float gamma) {
    vec4 tone_mapped = color / (color + vec4(1.0));
    return pow(tone_mapped, vec4(1.0 / gamma));
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

        // Point lights
        for (int i = 0; i < NUM_LIGHTS; i++) {
            vec4 light_pos = positions[i];
            vec4 light_color = colors[i];
            float maxRange = maxRanges[i];
            float light_intensity = intensities[i];
            bool enabled = enableds[i];

            if (enabled) {
                float luminance = pointLightLuminance(normal, world_position, light_pos, maxRange, i);
                color += albedo * light_color * luminance * light_intensity;
            }
        }
    }

    vec3 scattering = texture(SCATTERING, Inputs.texCoord).rgb;
    float transmittance = texture(TRANSMITTANCE, Inputs.texCoord).r;

    color.rgb = color.rgb * transmittance + scattering;

    FragColor = toneMap(color, GAMMA);
}