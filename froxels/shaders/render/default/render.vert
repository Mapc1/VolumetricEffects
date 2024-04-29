#version 430

uniform mat3 NORMAL_MAT;
uniform mat4 PVM, V, M;
uniform vec4 DIRECT_LIGHT_DIR;
uniform mat4 DIRECT_LIGHT_SPACE_MAT;


in vec4 position;
in vec4 normal;
in vec4 texCoord0;


out Data {
    vec4 projShadowCoord;
    vec3 normal;
    vec2 texCoord;
    vec3 lightDir;
    vec4 worldPos;
} DataOut;

void main() {
    DataOut.normal = normalize(NORMAL_MAT * vec3(normal));
    DataOut.texCoord = vec2(texCoord0);
    DataOut.lightDir = normalize(vec3(V * -DIRECT_LIGHT_DIR));
    DataOut.projShadowCoord = DIRECT_LIGHT_SPACE_MAT * M * position;
    DataOut.worldPos = M * position;
    DataOut.worldPos /= DataOut.worldPos.w;

    gl_Position = PVM * position; 
}