#version 460

// Directional light props
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform vec4 DIRECT_LIGHT_COLOR;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

// Point light 1 props
uniform samplerCube POINT_LIGHT_1_SHADOW_MAP;
uniform vec4 POINT_LIGHT_1_POS;
uniform vec4 POINT_LIGHT_1_COLOR;

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

// Settings props
uniform float AMBIENT_LIGHT_STRENGTH = 0.1;
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

    vec2 texel_size = 1.0 / textureSize(DIRECT_LIGHT_SHADOW_MAP, 0);
    for (int x = -1; x < 1; x++) {
        for (int y = -1; y < 1; y++) {
            vec4 offset = vec4(vec2(x,y) * texel_size, 0, 0);
            shadow += textureProj(DIRECT_LIGHT_SHADOW_MAP, proj_coord_with_bias + offset);
        }
    }

    return n_dot_l * (shadow/9);
}

float pointLightShadowIlumination(vec3 normal, vec4 worldPos, vec4 lightPos) {
    vec3 frag_light_dir = (worldPos - lightPos).xyz;
    vec4 view_frag_light_dir = V * vec4(frag_light_dir,0.0);
    float n_dot_l = max(0.0, -dot(normalize(normal), normalize(view_frag_light_dir.xyz)));
    if (n_dot_l <= 0.01)
        return 0.0;

    float currentDepth = length(frag_light_dir);

    float closestDepth = texture(POINT_LIGHT_1_SHADOW_MAP, frag_light_dir).r;
    closestDepth *= FAR;

    float bias = 0.05;
    float shadow = currentDepth - bias <= closestDepth ? 1.0 : 0.0;

    return n_dot_l * shadow;
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

    vec4 proj_shadow_coord = DIRECT_LIGHT_SPACE_MAT * world_position;

    vec4 color = vec4(0.0,0.0,0.0,1.0);
    if (skybox_flag < 1.0) {
        // Directional light lighting
        float luminance = shadowIlumination(normal, light_dir, proj_shadow_coord);
        color = albedo * DIRECT_LIGHT_COLOR * AMBIENT_LIGHT_STRENGTH;
        color += albedo * DIRECT_LIGHT_COLOR * luminance;

        // Point light 1 lighting
        float p_light_1_luminance = pointLightShadowIlumination(normal, world_position, POINT_LIGHT_1_POS);
        color += albedo * POINT_LIGHT_1_COLOR * AMBIENT_LIGHT_STRENGTH;
        color += albedo * POINT_LIGHT_1_COLOR * p_light_1_luminance;
    }

    vec3 scattering = texture(SCATTERING, Inputs.texCoord).rgb;
    float transmittance = texture(TRANSMITTANCE, Inputs.texCoord).r;

    color.rgb = color.rgb * transmittance + scattering;

    FragColor = toneMap(color, GAMMA);
}