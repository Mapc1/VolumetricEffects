#version 460

uniform sampler2D NORMAL;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

void main() {
    vec3 normal = texture(NORMAL, Inputs.texCoord).xyz;
    if (normal == vec3(0.0)) 
        discard;

    normal = normalize(normal * 2 - 1);
    
    FragColor = vec4(normal, 1.0);
}