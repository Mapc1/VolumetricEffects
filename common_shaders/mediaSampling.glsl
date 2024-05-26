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

vec3 worldPosToUVW(vec4 worldPos, vec4 minPos, vec4 maxPos, vec3 windOffset) {
    return ((worldPos - maxPos) / (maxPos-minPos)).xyz + windOffset;
}

float sampleMedia(vec4 worldPos, bool isHomogeneousMedia, vec4 minPos, vec4 maxPos, vec3 windOffset, sampler3D densityTexture){
    if(isHomogeneousMedia) 
        return 1.0;

    if (worldPos.y > maxPos.y || worldPos.y < minPos.y)
        return 0.0;

    vec3 uvw = worldPosToUVW(worldPos, minPos, maxPos, windOffset);
    return texture(DENSITY_UNIT, uvw).r;
}