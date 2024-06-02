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
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;

// Other props
uniform float AMBIENT_LIGHT_STRENGTH;
uniform int VOL_ACTIVE;

const float GAMMA = 2.2;

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

vec3 toneMap(vec3 color, float gamma) {
    color = color / (color + vec3(1.0));
    return pow(color, vec3(1.0/gamma)); 
}

void main() {
    vec3 normal = normalize(DataIn.normal);
    vec4 albedo = vec4(1.0,0.0,0.0,1.0);
    vec4 color = vec4(0.0);

    float luminance = shadowIlumination(normal, normalize(DataIn.lightDir));
    color = albedo * DIRECT_LIGHT_COLOR * luminance;

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