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
uniform int HOMOGENEOUS_MEDIA;

// Directional light props
uniform vec4 DIRECT_LIGHT_DIR;
uniform vec4 DIRECT_LIGHT_COLOR;
uniform float DIRECT_LIGHT_INTENSITY;
uniform bool DIRECT_LIGHT_ENABLED;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

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

// Camera props
uniform vec4 CAM_POS;
uniform float NEAR;
uniform float FAR;

// Renderer props
uniform mat4 V;
uniform uint FRAME_COUNT; 

uniform sampler3D DENSITY_UNIT;

const int NUM_LIGHTS = 10;

// For density texture
const vec3 DENSITY_TEX_DIMS = vec3(256,256,256);
const vec4 MIN = vec4(-3000,-3000,-3000,1.0);
const vec4 MAX = vec4(3000,3000,3000,1.0);

// Density texture stride
vec3 WIND = vec3(1.0,0.0,0.0);
float WIND_SPEED = 0.0002;

// Dither patter found in GPU Pro 5 page 134
float jitter[4][4] = {
    {0,     0.5,  0.125,  0.625},
    {0.75, 0.25,  0.875, 0.375},
    {0.1875,  0.6875, 0.0625,  0.5625},
    {0.9375, 0.4375,  0.8125, 0.3125}
};

in Data {
    vec2 texCoord;
} Inputs;

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

layout (location = 0) out vec4 accum_scattering;
layout (location = 1) out vec4 accum_transmittance;

float sampleMedia(vec4 worldPos, bool isHomogeneousMedia, vec4 minPos, vec4 maxPos, vec3 windOffset, sampler3D densityTexture);

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

vec2 pointLightLuminance(vec4 worldPos, vec4 lightPos, float const_att, float linear_att, float quad_att, int lightID) {
    vec3 frag_light_dir = (worldPos - lightPos).xyz;
    float current_depth = length(frag_light_dir);

    float closest_depth = sampleCorrectShadowMap(lightID, frag_light_dir);
    closest_depth *= FAR;

    float bias = 0;
    float shadow = current_depth - bias <= closest_depth ? 1.0 : 0.0;
    float attenuation = 1.0 / (const_att + linear_att * current_depth + quad_att * (current_depth*current_depth));

    return vec2(shadow * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH, AMBIENT_LIGHT_STRENGTH) * attenuation ;
}

vec2 directLightLuminance(vec4 worldPos) {
    vec4 light_space_pos = DIRECT_LIGHT_SPACE_MAT * worldPos;
    float shadow = textureProj(DIRECT_LIGHT_SHADOW_MAP, light_space_pos);

    return vec2(shadow * (1-AMBIENT_LIGHT_STRENGTH) + AMBIENT_LIGHT_STRENGTH, AMBIENT_LIGHT_STRENGTH);
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

//////////////////////////////////////////////////////////////////
//
//       In-scattering and volumetric shadows calculation
//
//////////////////////////////////////////////////////////////////
float getDirectLightVolumetricTransmittance(vec4 worldPos, vec4 minPos, vec4 maxPos, vec3 windOffset) {
    float transmittance = 1.0;
    vec4 curWorldPos = worldPos;
    vec4 stride = vec4(-DIRECT_LIGHT_DIR.xyz,0.0) * ((MAX.y-worldPos.y)/16);
    float strideLen = length(stride);

    for (int i = 0; i < 16 && curWorldPos.y < MAX.y; i++) {
        float density = sampleMedia(curWorldPos, HOMOGENEOUS_MEDIA == 0, minPos, maxPos, windOffset, DENSITY_UNIT) * DENSITY;
        vec3 scattering = SCATTERING * density;
        float absorption = ABSORPTION * density;
        float extinction = mean3(scattering) + absorption;
        float stepTransmittance = exp(-extinction*strideLen);
        transmittance *= stepTransmittance;
        curWorldPos += stride;
    }

    return transmittance;
}

float getPointLightVolumetricTransmittance(vec4 worldPos, vec4 lightPos, vec4 minPos, vec4 maxPos, vec3 windOffset) {
    float transmittance = 1.0;
    vec4 curWorldPos = worldPos;
    vec4 strideDir = lightPos-worldPos;
    float strideLen = length(strideDir)/16;
    vec4 stride = strideDir * strideLen;

    for (int i = 0; i < 16; i++) {
        float density = sampleMedia(curWorldPos, HOMOGENEOUS_MEDIA == 0, minPos, maxPos, windOffset, DENSITY_UNIT) * DENSITY;
        vec3 scattering = SCATTERING * density;
        float absorption = ABSORPTION * density;
        float extinction = mean3(scattering) + absorption;
        float stepTransmittance = exp(-extinction*strideLen);
        transmittance *= stepTransmittance;
        curWorldPos += stride;
    }

    return transmittance;
}

float calcDepth(int stepNum, float gBufferDepth, float jit) {
    // Exponential depth
    //return NEAR * pow(FAR/NEAR, stepNum / float(NUM_STEPS+jit));

    // Linear depth
    return ((gBufferDepth-NEAR)/NUM_STEPS) * (float(stepNum) + jit);
}

float screenCoordToJitter(vec2 screenCoord) {
    int x = int(mod(screenCoord.x, 4));
    int y = int(mod(screenCoord.y, 4));

    return jitter[x][y] - 0.5 * 0.999;
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
    float jit = screenCoordToJitter(gl_FragCoord.xy);
    vec4 cur_world_pos = CAM_POS + vec4(ray_dir*calcDepth(cur_step, linear_depth, jit), 0.0);
    vec3 wind_offset = FRAME_COUNT * WIND * WIND_SPEED;
    while (cur_depth < linear_depth && cur_depth < FAR) {
        float density = sampleMedia(cur_world_pos, HOMOGENEOUS_MEDIA == 0, MIN, MAX, wind_offset, DENSITY_UNIT) * DENSITY;
        float stride = calcDepth(cur_step, linear_depth, jit) - cur_depth;
        if (density > 0.00001) {
            vec3 scattering = SCATTERING * density;
            float absorption = ABSORPTION * density;
            float extinction = mean3(scattering) + absorption;

            vec3 in_scattering = vec3(0.0);
            if (DIRECT_LIGHT_ENABLED) {
                float phase = henyeyGreenstein(cur_world_pos, CAM_POS, DIRECT_LIGHT_DIR, ANISOTROPY);
                vec2 luminances = directLightLuminance(cur_world_pos) * getDirectLightVolumetricTransmittance(cur_world_pos, MIN, MAX, wind_offset);

                in_scattering += calcScattering(scattering, isotropic_phase, luminances.y, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
                in_scattering += calcScattering(scattering, phase, luminances.x, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
            }
            //for (int i = 0; i < NUM_LIGHTS; i++) {
            //    vec4 light_pos = positions[i];
            //    vec4 light_color = colors[i];
            //    float light_intensity = intensities[i];
            //    float const_att = constAtt[i];
            //    float linear_att = linearAtt[i];
            //    float quad_att = quadAtt[i];
            //    bool enabled = enableds[i];

            //    if (enabled) {
            //        vec4 world_light_dir = cur_world_pos - light_pos;
            //        vec2 luminances = pointLightLuminance(cur_world_pos, light_pos, const_att, linear_att, quad_att, i) * getPointLightVolumetricTransmittance(cur_world_pos, light_pos, MIN, MAX, wind_offset);
            //        float phase = henyeyGreenstein(cur_world_pos, CAM_POS, world_light_dir, ANISOTROPY);

            //        in_scattering += calcScattering(scattering, isotropic_phase, luminances.y, light_color, light_intensity);
            //        in_scattering += calcScattering(scattering, phase, luminances.x, light_color, light_intensity);
            //    }
            //}

            vec4 scatTrans = accumulateScatTrans(in_scattering, extinction, tmp_accum_scattering, tmp_accum_transmittance, stride);
            tmp_accum_scattering = scatTrans.rgb;
            tmp_accum_transmittance = scatTrans.a;
        }

        cur_world_pos += vec4(ray_dir * stride,0.0);
        vec4 cur_view_pos = V * cur_world_pos;
        cur_view_pos /= cur_view_pos.w;
        cur_depth = abs(cur_view_pos.z);
        cur_step++;
    }

    accum_scattering = vec4(tmp_accum_scattering,1.0);
    accum_transmittance = vec4(vec3(tmp_accum_transmittance),1.0);
}