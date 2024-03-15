#version 460

uniform vec4 LIGHT_COLOR;
uniform mat4 LIGHT_SPACE_MAT;

uniform sampler2D POSITION;
uniform sampler2D NORMAL;
uniform sampler2D ALBEDO;
uniform sampler2DShadow SHADOW_MAP;

uniform float AMBIENT_LIGHT_STRENGTH = 0.1; 
uniform int NUM_SHADOW_SAMPLES = 64;
uniform float GAMMA = 2.2;

in Data {
    vec2 texCoord;
    vec3 lightDir;
} Inputs;

out vec4 FragColor;

float shadowIlumination(vec3 normal, vec3 lightDir, vec4 proj_shadow_coord) {
    // If the surface is facing away from the light we don't add any illumination    
    float n_dot_l = max(0.0, dot(normal, lightDir));
    if (n_dot_l <= 0.01) {
        return 0.0;
    }

    float shadow = 0.0;
    vec4 proj_coord_with_bias = proj_shadow_coord;
    proj_coord_with_bias.z -= 0.0005;

    vec2 texel_size = 1.0 / textureSize(SHADOW_MAP, 0);
    for (int x = -1; x < 1; x++) {
        for (int y = -1; y < 1; y++) {
            vec4 offset = vec4(vec2(x,y) * texel_size, 0, 0);
            shadow += textureProj(SHADOW_MAP, proj_coord_with_bias + offset); 
        }
    }

    return n_dot_l * (shadow/9);
}

vec4 toneMap(vec4 color, float gamma) {
    vec4 tone_mapped = color / (color + vec4(1.0));
    return pow(tone_mapped, vec4(1.0 / gamma));
}

void main() {
    vec3 normal = texture(NORMAL, Inputs.texCoord).xyz;
    if (normal == vec3(0.0)) 
        discard;

    normal = normalize(normal * 2 - 1);
    vec4 world_position = texture(POSITION, Inputs.texCoord);
    vec4 albedo = texture(ALBEDO, Inputs.texCoord);
    vec3 light_dir = normalize(Inputs.lightDir);

    vec4 proj_shadow_coord = LIGHT_SPACE_MAT * world_position;

    float luminance = shadowIlumination(normal, light_dir, proj_shadow_coord); 
    vec4 color = albedo * LIGHT_COLOR * AMBIENT_LIGHT_STRENGTH;
    color += albedo * LIGHT_COLOR * luminance;
    
    FragColor = toneMap(color, GAMMA);
}