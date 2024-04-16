#version 460

#define PI 3.1415926538

// Variable params
uniform int VOL_ACTIVE;
uniform int NUM_STEPS;

// GBuffer
uniform sampler2D POSITION;

// Media props
uniform float ANISOTROPY;
uniform vec3 SCATTERING;
uniform float ABSORPTION;
uniform float DENSITY;

// Directional light props
uniform vec4 DIRECT_LIGHT_DIR;
uniform vec4 DIRECT_LIGHT_COLOR;
uniform float DIRECT_LIGHT_AMBIENT_STRENGTH;
uniform float DIRECT_LIGHT_INTENSITY;
uniform bool DIRECT_LIGHT_ENABLED;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

// Point light 1 props
uniform vec4 POINT_LIGHT_1_POS;
uniform vec4 POINT_LIGHT_1_COLOR;
uniform float POINT_LIGHT_1_AMBIENT_STRENGTH;
uniform float POINT_LIGHT_1_INTENSITY;
uniform float POINT_LIGHT_1_MAX_RANGE;
uniform bool POINT_LIGHT_1_ENABLED;
uniform samplerCube POINT_LIGHT_1_SHADOW_MAP;

// Camera props
uniform vec4 CAM_POS;
uniform float NEAR;
uniform float FAR;

// Renderer props
uniform mat4 V;


in Data {
    vec2 texCoord;
} Inputs;

layout (location = 0) out vec4 accum_scattering;
layout (location = 1) out vec4 accum_transmittance;


float henyeyGreenstein(vec4 world_pos, vec4 cam_pos, vec4 light_dir, float g) {
    vec4 point_cam_dir = normalize(cam_pos - world_pos);
    vec4 point_light_dir = normalize(light_dir);

    float cos_angle = dot(point_cam_dir, point_light_dir);
    float denom = 4*PI * pow((1+g*g - 2*g*cos_angle), 3/2);
    return (1-g*g) / denom;
}

float isotropicPhase() {
    return 1/(4*3.14159);
}

vec2 pointLightLuminance(vec4 worldPos, vec4 lightPos, float maxRange) {
    vec3 frag_light_dir = (worldPos - lightPos).xyz;
    float current_depth = length(frag_light_dir);

    float closest_depth = texture(POINT_LIGHT_1_SHADOW_MAP, frag_light_dir).r;
    closest_depth *= FAR;

    float bias = 0;
    float shadow = current_depth - bias <= closest_depth ? 1.0 : 0.0;
    float attenuation = max(0.0, (pow(maxRange, (maxRange-current_depth)/maxRange)) / maxRange);

    return vec2(shadow * (1-POINT_LIGHT_1_AMBIENT_STRENGTH) + POINT_LIGHT_1_AMBIENT_STRENGTH, POINT_LIGHT_1_AMBIENT_STRENGTH) * attenuation ;
}

vec2 directLightLuminance(vec4 worldPos) {
    vec4 light_space_pos = DIRECT_LIGHT_SPACE_MAT * worldPos;
    float shadow = textureProj(DIRECT_LIGHT_SHADOW_MAP, light_space_pos);

    return vec2(shadow * (1-DIRECT_LIGHT_AMBIENT_STRENGTH) + DIRECT_LIGHT_AMBIENT_STRENGTH, DIRECT_LIGHT_AMBIENT_STRENGTH);
}

float mean3(vec3 v) {
    return (v.x + v.y + v.z) / 3;
}

vec3 calcScattering(vec3 scattering, float phase, float inLight, vec4 lightColor, float intensity) {
    return scattering * intensity * phase * inLight * lightColor.rgb;
}

float linearizeDepth(float depth, float near, float far)
{
    float z = depth * 2.0 - 1.0; // back to NDC
    return (2.0 * near * far) / (far + near - z * (far - near));
}

vec4 accumulateScatTrans(vec3 in_scattering, float extinction, vec3 accum_scattering, float accum_transmittance, float stride_len) {
    if (extinction > 0.0) {
        float transmittance = exp(-extinction*stride_len);
        vec3 slice_light_integral = in_scattering * (1.0 - transmittance) / extinction;
        accum_scattering += slice_light_integral * accum_transmittance;
        accum_transmittance *= transmittance;
    }

    return vec4(accum_scattering,accum_transmittance);
}

vec4 toneMap(vec4 color, float gamma) {
    vec4 tone_mapped = color / (color + vec4(1.0));
    return pow(tone_mapped, vec4(1.0 / gamma));
}

float calcDepth(int stepNum) {
    // Exponential depth
    //return NEAR * pow(FAR/NEAR, (float(stepNum)+0.5) / float(NUM_STEPS));

   // Linear depth
   return ((FAR -NEAR)/NUM_STEPS) * stepNum;
}

void main() {
    if (VOL_ACTIVE == 1) {
        accum_scattering = vec4(0.0);
        accum_transmittance = vec4(1.0);
        return;
    }

    vec2 tex_coord = Inputs.texCoord;

    vec4 world_pos = texture(POSITION, tex_coord);
    if (world_pos == vec4(0.0))
        discard;

    vec4 view_pos = V * world_pos;
    view_pos /= view_pos.w;
    float linear_depth = abs(view_pos.z);

    vec3 ray_dir = normalize(world_pos - CAM_POS).xyz;

    vec3 tmp_accum_scattering = vec3(0.0);
    float tmp_accum_transmittance = 1.0;

    float isotropic_phase = isotropicPhase();

    float cur_depth = 0.0;
    int cur_step = 1;
    vec4 cur_world_pos = CAM_POS + vec4(ray_dir,0.0)*calcDepth(cur_step);
    while (cur_depth < linear_depth && cur_depth < FAR) {
        float density = DENSITY;
        vec3 scattering = SCATTERING * density;
        float absorption = ABSORPTION * density;
        float extinction = mean3(scattering) + absorption;
        float stride = calcDepth(cur_step) - cur_depth;

        vec3 in_scattering = vec3(0.0);
        if (DIRECT_LIGHT_ENABLED) {
            float phase = henyeyGreenstein(cur_world_pos, CAM_POS, DIRECT_LIGHT_DIR, ANISOTROPY);
            vec2 luminances = directLightLuminance(cur_world_pos);

            in_scattering += calcScattering(scattering, isotropic_phase, luminances.y, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
            in_scattering += calcScattering(scattering, phase, luminances.x, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
        }
        if (POINT_LIGHT_1_ENABLED) {
            vec4 world_light_dir = cur_world_pos-POINT_LIGHT_1_POS;
            vec2 luminances = pointLightLuminance(cur_world_pos, POINT_LIGHT_1_POS, POINT_LIGHT_1_MAX_RANGE);
            float phase = henyeyGreenstein(cur_world_pos, CAM_POS, world_light_dir, ANISOTROPY);

            in_scattering += calcScattering(scattering, isotropic_phase, luminances.y, POINT_LIGHT_1_COLOR, POINT_LIGHT_1_INTENSITY);
            in_scattering += calcScattering(scattering, phase, luminances.x, POINT_LIGHT_1_COLOR, POINT_LIGHT_1_INTENSITY);
        }

        vec4 scatTrans = accumulateScatTrans(in_scattering, extinction, tmp_accum_scattering, tmp_accum_transmittance, stride);
        tmp_accum_scattering = scatTrans.rgb;
        tmp_accum_transmittance = scatTrans.a;

        cur_world_pos += vec4(ray_dir * stride,0.0);
        vec4 cur_view_pos = V * cur_world_pos;
        cur_view_pos /= cur_view_pos.w;
        cur_depth = abs(cur_view_pos.z);
        cur_step++;
    }

    accum_scattering = vec4(tmp_accum_scattering,1.0);
    accum_transmittance = vec4(vec3(tmp_accum_transmittance),1.0);
}