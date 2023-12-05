#version 430

#define NUM_SHADOW_SAMPLES 32

uniform sampler2DShadow SHADOW_MAP;
uniform sampler2D TEX_UNIT;
uniform sampler3D INTEGRATION_UNIT;

uniform mat4 V, P;
uniform float NEAR;
uniform float FAR;

uniform vec4 LIGHT_COLOR;


in Data {
    vec4 projShadowCoord;
    vec3 normal;
    vec3 lightDir;
    vec4 worldPos;
} DataIn;


out vec4 FragColor;

float rand(vec2 co);
vec3 world_to_uv(vec3 world_pos, float n, float f, float depth_power, mat4 vp);

float shadowIlumination(vec3 normal, vec3 lightDir) {
    // If the surface is facing away from the light we don't add any illumination
    float NdotL = max(0.0, dot(normal, lightDir));
    if (NdotL <= 0.01) {
        return 0.0;
    }

    float shadow = 0.0;
    vec2 rand_input_x = gl_FragCoord.xy;
    vec2 rand_input_y = gl_FragCoord.yx;

    for (int i = 0; i < NUM_SHADOW_SAMPLES; i++) {
        float x_jitter = rand(rand_input_x) / 4096;
        float y_jitter = rand(rand_input_y) / 4096;

        rand_input_x = vec2(x_jitter, y_jitter);
        rand_input_y = vec2(y_jitter, x_jitter);

        shadow += textureProj(SHADOW_MAP, DataIn.projShadowCoord/DataIn.projShadowCoord.w + vec4(x_jitter, y_jitter, 0, 0));
    }

    return NdotL * (shadow/NUM_SHADOW_SAMPLES);
}


void main() {
    vec3 normal = normalize(DataIn.normal);
    vec4 diff = vec4(0.6,0.0,0.0,1.0);
    vec4 color = diff * LIGHT_COLOR * 0.25;

    color += diff * LIGHT_COLOR * shadowIlumination(normal,DataIn.lightDir);

    vec3 uvw = world_to_uv(DataIn.worldPos.xyz, NEAR, FAR, 0.0, P*V);
    vec4 scatTransmittance = texture(INTEGRATION_UNIT, uvw);
    vec3 inScattering = scatTransmittance.rgb;
    float transmittance = scatTransmittance.a;

    color.rgb = color.rgb * transmittance + inScattering;

    FragColor = color;
}
