#version 430

#define NUM_SHADOW_SAMPLES 64

// Input textures
uniform sampler2D TEX_UNIT;
uniform sampler3D INTEGRATION_UNIT;

// Camera and renderer props
uniform mat4 PV, V;
uniform float NEAR;
uniform float FAR;

// Directional light props
uniform vec4 DIRECT_LIGHT_COLOR;
uniform bool DIRECT_LIGHT_ENABLED;
uniform float DIRECT_LIGHT_INTENSITY;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;

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

// Other props
uniform float AMBIENT_LIGHT_STRENGTH;
uniform int VOL_ACTIVE;

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
    vec4 projShadowCoord;
    vec3 normal;
    vec2 texCoord;
    vec3 lightDir;
    vec4 worldPos;
} DataIn;


out vec4 FragColor;

vec4 textureTricubic(sampler3D tex, vec3 coord);
vec3 world_to_uv(vec3 world_pos, float n, float f, float depth_power, mat4 vp);

float shadowIlumination(vec3 normal, vec3 lightDir) {
    // If the surface is facing away from the light we don't add any illumination    
    float NdotL = max(0.0, dot(normal, lightDir));
    if (NdotL <= 0.01) {
        return AMBIENT_LIGHT_STRENGTH;
    }

    float shadow = 0.0;
    vec4 projShadowCoordBias = DataIn.projShadowCoord;
    projShadowCoordBias.z -= 0.001;

    vec2 texelSize = 1.0 / textureSize(DIRECT_LIGHT_SHADOW_MAP, 0);
    for (int x = -1; x < 1; x++) {
        for (int y = -1; y < 1; y++) {
            vec4 offset = vec4(vec2(x,y) * texelSize, 0, 0);
            shadow += textureProj(DIRECT_LIGHT_SHADOW_MAP, projShadowCoordBias + offset); 
        }
    }

    return ((NdotL * (shadow/9)) * (1-AMBIENT_LIGHT_STRENGTH)) + AMBIENT_LIGHT_STRENGTH;
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

    float closest_depth = sampleCorrectShadowMap(lightID, frag_light_dir);
    closest_depth *= FAR;

    float bias = 0.1;
    float shadow = current_depth - bias <= closest_depth ? 1.0 : 0.0;
    float luminance = n_dot_l * shadow * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH;

    float attenuation = max(0.0, (pow(maxRange, (maxRange-current_depth)/maxRange))/maxRange);

    return luminance * attenuation;
}

vec3 toneMap(vec3 color, float gamma) {
    color = color / (color + vec3(1.0));
    return pow(color, vec3(1.0/gamma)); 
}

void main() {
    vec3 normal = normalize(DataIn.normal);
    vec4 albedo = texture(TEX_UNIT, DataIn.texCoord);
    vec4 color = vec4(0.0);

    if (DIRECT_LIGHT_ENABLED) {
        float luminance = shadowIlumination(normal, normalize(DataIn.lightDir));
        color = albedo * DIRECT_LIGHT_COLOR * luminance;
    }

    for (int i = 0; i < NUM_LIGHTS; i++) {
        vec4 lightPos = positions[i];
        vec4 lightColor = colors[i];
        float maxRange = maxRanges[i];
        float lightIntensity = intensities[i];
        bool enabled = enableds[i];

        if (enabled) {
            float luminance = pointLightLuminance(normal, DataIn.worldPos, lightPos, maxRange, i);
            color += albedo * lightColor * luminance;
        }
    }

    if (VOL_ACTIVE == 0) {
        vec3 uvw = world_to_uv(DataIn.worldPos.xyz, NEAR, FAR, 0.0, PV);

        vec4 scatTransmittance = textureTricubic(INTEGRATION_UNIT, uvw);
        vec3 inScattering = scatTransmittance.rgb;
        float transmittance = scatTransmittance.a;

        inScattering = toneMap(inScattering, GAMMA);

        color.rgb = color.rgb * transmittance + inScattering;
    }

    FragColor = color;
}