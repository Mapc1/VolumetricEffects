#version 460

uniform sampler2D POSITION;
uniform sampler2D NORMAL;
uniform sampler2D ALBEDO;
uniform sampler2D SKYBOX_FLAG;

uniform mat4 V;
uniform float FAR;

uniform float AMBIENT_LIGHT_STRENGTH;

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

uniform int DEBUG = 1;

const uint NUM_LIGHTS = 10;

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
    float constAtt[NUM_LIGHTS];
};
layout(std430, binding = 5) buffer Buff5 {
    float linearAtt[NUM_LIGHTS];
};
layout(std430, binding = 6) buffer Buff6 {
    float quadAtt[NUM_LIGHTS];
};
layout(std430, binding = 7) buffer Buff7 {
    bool enableds[NUM_LIGHTS];
};

in Data {
    flat int lightID;
} Inputs;

out vec4 ilumination;

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

float pointLightLuminance(vec3 normal, vec4 worldPos, int lightID) {
    vec4 light_pos = positions[lightID];
    float const_att = constAtt[lightID];
    float linear_att = linearAtt[lightID];
    float quad_att = quadAtt[lightID];
    float intensity = intensities[lightID];
    
    vec3 frag_light_dir = (worldPos - light_pos).xyz;
    vec4 view_frag_light_dir = V * vec4(frag_light_dir,0.0);
    float n_dot_l = max(0.0, -dot(normalize(normal), normalize(view_frag_light_dir.xyz)));

    float current_depth = length(frag_light_dir);

    float closest_depth = sampleCorrectShadowMap(lightID, frag_light_dir);
    closest_depth *= FAR;

    float bias = 0.05;
    float shadow = current_depth - bias <= closest_depth ? 1.0 : 0.0;
    float luminance = n_dot_l * shadow * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH;

    float attenuation = 1.0 / (const_att + linear_att * current_depth + quad_att * (current_depth*current_depth));
    //max(0.0, (pow(maxRange, (maxRange-current_depth)/maxRange))/maxRange);

    return luminance * attenuation * intensity;
}

vec2 getTexCoord() {
    vec2 screenSize = textureSize(POSITION, 0);
    vec2 pixelCoord = gl_FragCoord.xy;

    return pixelCoord/screenSize;
}

void main() {
    int light_id = Inputs.lightID;
    bool enabled = enableds[light_id];
    if (!enabled)
        discard;
    

    vec4 light_color = colors[light_id];
    if (DEBUG == 0) {
        ilumination = vec4(1.0);
        return;
    }

    vec2 tex_coord = getTexCoord();

    float skybox_flag = texture(SKYBOX_FLAG, tex_coord).r;
    if (skybox_flag == 1.0)
        discard;

    vec4 frag_pos = texture(POSITION, tex_coord);
    vec4 albedo = texture(ALBEDO, tex_coord);
    vec3 normal = texture(NORMAL, tex_coord).rgb * 2 - 1;
    
    
    float luminance = pointLightLuminance(normal, frag_pos, light_id);
    ilumination = vec4((albedo * light_color * luminance).rgb, 1.0);
}