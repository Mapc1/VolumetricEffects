#version 460

uniform sampler2D DEPTH;

in Data {
    vec2 texCoord;
} Inputs;

out vec4 FragColor;

const float near = 1.0;
const float far = 7000.0;

float linearizeDepth(float depth) 
{
    float z = depth * 2.0 - 1.0; // back to NDC 
    return (2.0 * near * far) / (far + near - z * (far - near));	
}

void main() {
    float depth = texture(DEPTH, Inputs.texCoord).r;
    if (depth == 0.0) 
        discard;

    float linearDepth = linearizeDepth(depth) / far;
    FragColor = vec4(vec3(linearDepth), 1.0);
}