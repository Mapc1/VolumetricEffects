#version 460

uniform sampler2D POSITION;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

void main() {
    vec3 position = texture(POSITION, Inputs.texCoord).xyz;
    if (position == vec3(0.0))
        discard;

    FragColor = vec4(position, 1.0);
}