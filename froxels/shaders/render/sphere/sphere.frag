#version 430

#define NUM_SHADOW_SAMPLES 32

uniform sampler2DShadow SHADOW_MAP;
uniform sampler2D TEX_UNIT;
uniform sampler3D INTEGRATION_UNIT;

uniform mat4 V, P;
uniform float NEAR;
uniform float FAR;

uniform vec4 LIGHT_COLOR;

uniform float AMBIENT_LIGHT_STRENGTH;
uniform int VOL_ACTIVE;
uniform float GAMMA = 2.2;

in Data {
    vec4 projShadowCoord;
    vec3 normal;
    vec3 lightDir;
    vec4 worldPos;
} DataIn;


out vec4 FragColor;

vec3 world_to_uv(vec3 world_pos, float n, float f, float depth_power, mat4 vp);

float shadowIlumination(vec3 normal, vec3 lightDir) {
    // If the surface is facing away from the light we don't add any illumination    
    float NdotL = max(0.0, dot(normal, lightDir));
    if (NdotL <= 0.01) {
        return 0.0;
    }

    float shadow = 0.0;
    vec4 projShadowCoordBias = DataIn.projShadowCoord;
    projShadowCoordBias.z -= 0.001;

    vec2 texelSize = 1.0 / textureSize(SHADOW_MAP, 0);
    for (int x = -1; x < 1; x++) {
        for (int y = -1; y < 1; y++) {
            vec4 offset = vec4(vec2(x,y) * texelSize, 0, 0);
            shadow += textureProj(SHADOW_MAP, projShadowCoordBias + offset); 
        }
    }

    return NdotL * (shadow/9);
}


void main() {
    vec3 normal = normalize(DataIn.normal);
    vec4 diff = vec4(0.6,0.0,0.0,1.0);
    vec4 color = diff * LIGHT_COLOR * AMBIENT_LIGHT_STRENGTH;

    color += diff * LIGHT_COLOR * shadowIlumination(normal,DataIn.lightDir);

    vec3 uvw = world_to_uv(DataIn.worldPos.xyz, NEAR, FAR, 0.0, P*V);
    vec4 scatTransmittance = texture(INTEGRATION_UNIT, uvw);
    vec3 inScattering = scatTransmittance.rgb;
    float transmittance = scatTransmittance.a;

    if (VOL_ACTIVE == 0) {
        color.rgb = color.rgb * transmittance + inScattering;
    }

    color = color / (color + vec4(1.0));
    color = pow(color, vec4(1.0 / GAMMA));
    FragColor = color;
}
