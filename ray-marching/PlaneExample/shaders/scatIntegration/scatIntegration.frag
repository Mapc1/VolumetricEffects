#version 460

#define PI 3.1415926538

// Variable params
uniform int VOL_ACTIVE;
uniform int NUM_STEPS;

// GBuffer
uniform sampler2D POSITION;

// Cube and sphere fog props
uniform vec3 CUBE_SCATTERING;
uniform float CUBE_ABSORPTION;
uniform float CUBE_DENSITY;
uniform float CUBE_ANISOTROPY;

uniform vec3 SPHERE_SCATTERING;
uniform float SPHERE_ABSORPTION;
uniform float SPHERE_DENSITY;
uniform float SPHERE_ANISOTROPY;

// Directional light props
uniform vec4 DIRECT_LIGHT_DIR;
uniform vec4 DIRECT_LIGHT_COLOR;
uniform float DIRECT_LIGHT_INTENSITY;
uniform bool DIRECT_LIGHT_ENABLED;
uniform sampler2DShadow DIRECT_LIGHT_SHADOW_MAP;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;

uniform float AMBIENT_LIGHT_STRENGTH;

// Camera props
uniform vec4 CAM_POS;
uniform float NEAR;
uniform float FAR;

// Renderer props
uniform mat4 V;

const int NUM_LIGHTS = 10;


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

layout (location = 0) out vec4 accum_scattering;
layout (location = 1) out vec4 accum_transmittance;

vec2 exampleCubeSphere(vec4 worldPos, float cubeDensity, float sphereDensity);

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
float getDirectLightVolumetricTransmittance(vec4 worldPos) {
    const float ceiling = 500;

    float transmittance = 1.0;
    vec4 curWorldPos = worldPos;
    vec4 stride = vec4(-DIRECT_LIGHT_DIR.xyz,0.0) * ((ceiling-worldPos.y)/16);
    float strideLen = length(stride);

    for (int i = 0; i < 16 && curWorldPos.y < ceiling; i++) {
        vec2 densities = exampleCubeSphere(curWorldPos, CUBE_DENSITY, SPHERE_DENSITY);
        vec3 scattering = CUBE_SCATTERING*densities.x + SPHERE_SCATTERING*densities.y;
        float absorption = CUBE_ABSORPTION*densities.x + SPHERE_ABSORPTION*densities.y;
        float extinction = mean3(scattering) + absorption;
        float stepTransmittance = exp(-extinction*strideLen);
        transmittance *= stepTransmittance;
        curWorldPos += stride;
    }

    return transmittance;
}

float calcDepth(int stepNum, float gBufferDepth, float jit) {
    // Exponential depth
    return NEAR * pow(gBufferDepth/NEAR, stepNum / float(NUM_STEPS+jit));

    // Linear depth
//    return ((gBufferDepth-NEAR)/NUM_STEPS) * (float(stepNum) + jit);
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
    while (cur_depth < linear_depth && cur_depth < FAR) {
        vec2 densities = exampleCubeSphere(cur_world_pos, CUBE_DENSITY, SPHERE_DENSITY);
        float stride = calcDepth(cur_step, linear_depth, jit) - cur_depth;
        if (any(greaterThan(densities, vec2(0.00001)))) {
            vec3 scattering = CUBE_SCATTERING*densities.x + SPHERE_SCATTERING*densities.y;
            float absorption = CUBE_ABSORPTION*densities.x + SPHERE_ABSORPTION*densities.y;
            float extinction = mean3(scattering) + absorption;

            vec3 in_scattering = vec3(0.0);
            if (DIRECT_LIGHT_ENABLED) {
                float phaseCube = densities.x > 0.00001 ? henyeyGreenstein(cur_world_pos, CAM_POS, DIRECT_LIGHT_DIR, CUBE_ANISOTROPY) : 0;
                float phaseSphere = densities.y > 0.00001 ? henyeyGreenstein(cur_world_pos, CAM_POS, DIRECT_LIGHT_DIR, SPHERE_ANISOTROPY) : 0;
                float combinedPhase = (phaseCube + phaseSphere) / 2;
                
                vec2 luminances = directLightLuminance(cur_world_pos) * getDirectLightVolumetricTransmittance(cur_world_pos);

                in_scattering += calcScattering(scattering, isotropic_phase, luminances.y, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
                in_scattering += calcScattering(scattering, combinedPhase, luminances.x, DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);
            }

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