// Found this code here (https://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl)
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}