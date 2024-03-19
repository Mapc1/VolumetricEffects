#version 460

uniform sampler2D POSITION;
uniform sampler2D DEPTH;
uniform sampler1DShadow SHADOW_MAP;

uniform vec4 CAM_POS;
uniform float NEAR = 1.0;
uniform float FAR = 7000.0;
uniform mat4 V;

uniform int NUM_STEPS = 64;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

float linearizeDepth(float depth, float near, float far)
{
    float z = depth * 2.0 - 1.0; // back to NDC
    return (2.0 * near * far) / (far + near - z * (far - near));
}

void main() {
    vec2 tex_coord = Inputs.texCoord;

    vec4 world_pos = texture(POSITION, tex_coord);
    if (world_pos == vec4(0.0)) {
        FragColor = vec4(1.0);
        return;
    }

    float depth = texture(DEPTH, tex_coord).r;
    float linearDepth = linearizeDepth(depth, NEAR, FAR);

    vec4 ray_dir = normalize(world_pos - CAM_POS);
    vec4 stride = ray_dir * ((FAR - NEAR) / NUM_STEPS);

    float cur_depth = 0.0;
    float max_dist = 0.0;
    vec4 cur_world_pos = CAM_POS;
    while (cur_depth < linearDepth && cur_depth < FAR) {
        max_dist = length(cur_world_pos - CAM_POS) / FAR;

        cur_world_pos += stride;
        vec4 cur_view_pos = V * cur_world_pos;
        cur_view_pos /= cur_view_pos.w;
        cur_depth = abs(cur_view_pos.z);
    }

    FragColor = vec4(vec3(max_dist), 1.0);
}