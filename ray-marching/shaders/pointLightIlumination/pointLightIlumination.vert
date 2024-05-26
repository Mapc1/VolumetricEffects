#version 460

uniform mat4 PVM;
uniform mat4 PV;
uniform mat4 M;
uniform mat3 NORMAL_MAT;

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

in vec4 position;
in vec3 normal;

out Data {
    flat int lightID;
} Outputs;

const float smallest_luminance = 256/5;

float calcRadius(int lightID) {
    float const_att = constAtt[lightID];
    float linear_att = linearAtt[lightID];
    float quad_att = quadAtt[lightID];
    float intensity = intensities[lightID];
    vec4 color = colors[lightID];

    vec4 light_luminance = color * intensity;
    float light_max_component = max(max(light_luminance.x,light_luminance.y),light_luminance.z);

    return (-linear_att + sqrt(linear_att * linear_att - 4 * quad_att * (const_att - smallest_luminance * light_max_component))) / (2 * quad_att); 
}

vec4 getShiftedPos(uint lightID, float radius) {
    vec4 sphere_center = positions[lightID];

    return sphere_center + vec4(normal * radius,0.0);
}

void main() {
    int light_id = gl_InstanceID;
    float radius = calcRadius(light_id);
    vec4 worldPos = getShiftedPos(light_id, radius);

    Outputs.lightID = light_id;
    gl_Position = PVM * worldPos; 
}