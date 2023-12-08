#version 460

uniform samplerCube CUBEMAP;
uniform sampler3D INTEGRATION_UNIT;

uniform mat4 M, V, P;
uniform float NEAR;
uniform float FAR;
uniform vec4 CAM_POS;

in Data {
    vec4 localPos;
} DataIn;

out vec4 FragColor;


vec3 world_to_uv(vec3 world_pos, float n, float f, float depth_power, mat4 vp);

void main() {
    // We need to map the skybox worldPos to a sphere otherwise
    // with the addition of volumetric effects it will be noticeable
    // that it is just a box.
    vec3 texCoord = normalize(vec3(DataIn.localPos));
    vec4 worldPos = M * (vec4(texCoord,1.0) + CAM_POS) ;

    vec3 uvw = world_to_uv(worldPos.xyz, NEAR, FAR, 0.0, P*V);
    vec4 inScatTransmittance = texture(INTEGRATION_UNIT, uvw);
    vec3 inScattering = inScatTransmittance.rgb;
    float transmittance = inScatTransmittance.a;

    vec4 color = texture(CUBEMAP, texCoord);
    color.rgb = color.rgb + inScattering.rgb;

    FragColor = color;
}