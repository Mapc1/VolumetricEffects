#version 460

uniform sampler2D ALBEDO;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

void main() {
    vec3 albedo = texture(ALBEDO, Inputs.texCoord).xyz;
    if (albedo == vec3(0.0)) 
        discard;

    FragColor = vec4(albedo, 1.0);
}