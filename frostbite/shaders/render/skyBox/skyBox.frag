#version 460

uniform samplerCube CUBEMAP;
uniform sampler3D INTEGRATION_UNIT;

uniform mat4 V, P;
uniform float NEAR;
uniform float FAR;

in Data {
    vec4 localPos;
    vec4 worldPos;
} DataIn;

out vec4 FragColor;


vec3 world_to_uv(vec3 world_pos, float n, float f, float depth_power, mat4 vp);

void main() {
    vec4 color = texture(CUBEMAP, normalize(vec3(DataIn.localPos)));
    
    vec3 uvw = world_to_uv(DataIn.worldPos.xyz, NEAR, FAR, 0.0, P*V);

    // We don't make use of transmittance because it breaks the illusion of the
    // skybox, because since the vertices of the cube are farther away you are able
    // to see it's just a cube. 
    vec3 inScattering = texture(INTEGRATION_UNIT, uvw).rgb;
    color.rgb = color.rgb + inScattering;

    FragColor = color;
}