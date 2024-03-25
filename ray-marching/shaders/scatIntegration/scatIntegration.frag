#version 460

#define PI 3.1415926538

uniform sampler2D POSITION;
uniform sampler2D DEPTH;
uniform sampler2DShadow SHADOW_MAP;

uniform vec4 CAM_POS;
uniform float NEAR;
uniform float FAR;
uniform mat4 V;
uniform mat4 LIGHT_SPACE_MAT;
uniform vec4 LIGHT_DIR;
uniform vec4 LIGHT_COLOR;

uniform vec2 WINDOW_SIZE = vec2(1280,720);
uniform float RATIO;
uniform float FOV = 60.0;
uniform vec4 CAM_VIEW, CAM_UP, CAM_RIGHT;

uniform int NUM_STEPS = 64;

// Variable params
uniform float ANISOTROPY;
uniform vec3 SCATTERING;
uniform float ABSORPTION;
uniform float DENSITY;
uniform float LIGHT_INTENSITY;
uniform int VOL_ACTIVE;

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

float sampleShadowMap(vec4 projShadowCoord) {
    return textureProj(SHADOW_MAP, projShadowCoord);
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

vec3 getRayDir(vec2 fragCoord) {
  vec3 ray_dir;

  float focal_length = 1.0 / tan(radians(FOV*0.5)); // Distance from camera to pixel plane

  ray_dir.xy = (2.0*fragCoord/WINDOW_SIZE) - 1.0;
  ray_dir.x *= RATIO;
  ray_dir.z = -focal_length;
  ray_dir = normalize(ray_dir);
  ray_dir = mat3(
    vec3(CAM_RIGHT),
    vec3(CAM_UP),
    vec3(-CAM_VIEW)
  ) * ray_dir;

  return ray_dir;
}

void main() {
    if (VOL_ACTIVE == 1) {
        accum_scattering = vec4(0.0);
        accum_transmittance = vec4(1.0);
        return;
    }

    vec2 tex_coord = Inputs.texCoord;

    vec4 world_pos = texture(POSITION, tex_coord);
    if (world_pos == vec4(0.0)) {
        discard;
    }

    float depth = texture(DEPTH, tex_coord).r;
    float linear_depth = linearizeDepth(depth, NEAR, FAR);

    if (world_pos == vec4(0.0))
        linear_depth = FAR;

    vec3 ray_dir = normalize(world_pos - CAM_POS).xyz;
    vec4 stride = vec4(ray_dir * ((FAR - NEAR) / NUM_STEPS), 0.0);

    vec3 tmp_accum_scattering = vec3(0.0);
    float tmp_accum_transmittance = 1.0;

    float cur_depth = 0.0;
    float max_dist = 0.0;
    vec4 cur_world_pos = CAM_POS + stride;
    float stride_len = length(stride);
    float cur_len = 0.0;
    while (cur_depth < linear_depth && cur_depth < FAR) {
        float density = DENSITY;
        vec3 scattering = SCATTERING * density;
        float absorption = ABSORPTION * density;
        float extinction = mean3(scattering) + absorption;

        float phase = henyeyGreenstein(cur_world_pos, CAM_POS, LIGHT_DIR, ANISOTROPY);
        vec4 proj_coord = LIGHT_SPACE_MAT * cur_world_pos;
        float shadow = sampleShadowMap(+proj_coord);

        vec3 in_scattering = calcScattering(scattering, phase, shadow, LIGHT_COLOR, LIGHT_INTENSITY);

        vec4 lol = accumulateScatTrans(in_scattering, extinction, tmp_accum_scattering, tmp_accum_transmittance, stride_len);
        tmp_accum_scattering = lol.rgb;
        tmp_accum_transmittance = lol.a;

        cur_world_pos += stride;
        vec4 cur_view_pos = V * cur_world_pos;
        cur_view_pos /= cur_view_pos.w;
        cur_depth = abs(cur_view_pos.z);
    }

    accum_scattering = vec4(tmp_accum_scattering,1.0);
    accum_transmittance = vec4(vec3(tmp_accum_transmittance),1.0);
}