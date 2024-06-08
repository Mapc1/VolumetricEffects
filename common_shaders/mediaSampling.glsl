float sdfCube(vec4 worldPos, vec4 center, float lengthX, float lengthY, float lengthZ) {
    float halfLenX = lengthX / 2;
    float halfLenY = lengthY / 2;
    float halfLenZ = lengthZ / 2;

    return (
        worldPos.x <= halfLenX+center.x && worldPos.x >= -halfLenX+center.x &&
        worldPos.y <= halfLenY+center.y && worldPos.y >= -halfLenY+center.y &&
        worldPos.z <= halfLenZ+center.z && worldPos.z >= -halfLenZ+center.z
    ) ? 1.0 : 0.0;
}

float sdfSphere(vec4 worldPos, vec4 center, float radius) {
    float dist = length(worldPos - center);

    return dist < radius ? 1.0 : 0.0;
}

float homogeneousMedia() {
    return 1.0;
}

// Returns 2 floats representing the densities of 2 different medias
vec2 exampleCubeSphere(vec4 worldPos, float cubeDensity, float sphereDensity) {
    // Cube params
    vec4 cubeCenter = vec4(-50.0,100.0,0.0,1.0);
    float sideLen = 200.0;

    // Sphere params
    vec4 sphereCenter = vec4(25.0,150.0,0.0,1.0);
    float radius = 100.0;

    return vec2(
        sdfCube(worldPos, cubeCenter, sideLen, sideLen, sideLen) * cubeDensity,
        sdfSphere(worldPos, sphereCenter, radius) * sphereDensity
    );
}

vec3 worldPosToUVW(vec4 worldPos, vec4 minPos, vec4 maxPos, vec3 windOffset) {
    return ((worldPos - maxPos) / (maxPos-minPos)).xyz + windOffset;
}

float sampleMedia(vec4 worldPos, bool isHomogeneousMedia, vec4 minPos, vec4 maxPos, vec3 windOffset, sampler3D densityTexture){
    if(isHomogeneousMedia) 
        return 1.0;

    if (worldPos.y < minPos.y || worldPos.y > maxPos.y)
        return 0.0;

    vec3 uvw = worldPosToUVW(worldPos, minPos, maxPos, windOffset);
    return texture(densityTexture, uvw).r;
}
