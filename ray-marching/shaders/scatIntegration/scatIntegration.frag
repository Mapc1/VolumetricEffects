#version 460

#define PI 3.1415926538

// Variable params
uniform float ANISOTROPY;
uniform vec3 SCATTERING;
uniform float ABSORPTION;
uniform float DENSITY;
uniform float LIGHT_INTENSITY;
uniform int VOL_ACTIVE;
uniform int NUM_STEPS = 64;

// GBuffer
uniform sampler2D POSITION;

// Directional light props
uniform vec4 DIRECT_LIGHT_DIR;
uniform vec4 DIRECT_LIGHT_COLOR;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

// Point light 1 props
uniform vec4 POINT_LIGHT_1_COLOR;
uniform vec4 POINT_LIGHT_1_POS;
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

float pointLightShadowIlumination(vec4 worldPos, vec4 lightPos) {
    vec3 frag_light_dir = (worldPos - lightPos).xyz;
    float currentDepth = length(frag_light_dir);

    float closestDepth = texture(POINT_LIGHT_1_SHADOW_MAP, frag_light_dir).r;
    closestDepth *= FAR;

    float bias = 0;
    float shadow = currentDepth - bias <= closestDepth ? 1.0 : 0.0;

    return shadow;
}

float sampleShadowMap(vec4 projShadowCoord) {
    return textureProj(DIRECT_LIGHT_SHADOW_MAP, projShadowCoord);
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

    float cur_depth = 0.0;
    int cur_step = 1;
    vec4 cur_world_pos = CAM_POS + vec4(ray_dir,0.0)*calcDepth(cur_step);
    while (cur_depth < linear_depth && cur_depth < FAR) {
        float density = DENSITY;
        vec3 scattering = SCATTERING * density;
        float absorption = ABSORPTION * density;
        float extinction = mean3(scattering) + absorption;
        float stride = calcDepth(cur_step) - cur_depth;

        float phase = henyeyGreenstein(cur_world_pos, CAM_POS, DIRECT_LIGHT_DIR, ANISOTROPY);
        vec4 proj_coord = DIRECT_LIGHT_SPACE_MAT * cur_world_pos;
        float shadow = sampleShadowMap(proj_coord);

        vec3 in_scattering = calcScattering(scattering, phase, shadow, DIRECT_LIGHT_COLOR, LIGHT_INTENSITY);

        vec4 world_light_dir = cur_world_pos-POINT_LIGHT_1_POS;
        shadow = pointLightShadowIlumination(cur_world_pos, POINT_LIGHT_1_POS);
        phase = henyeyGreenstein(cur_world_pos, CAM_POS, world_light_dir, ANISOTROPY);
        in_scattering += calcScattering(scattering, phase, shadow, POINT_LIGHT_1_COLOR, LIGHT_INTENSITY);

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