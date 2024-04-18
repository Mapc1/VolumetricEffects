function TableConcat(t1,t2)
    for i=1,#t2 do
        t1[#t1+1] = t2[i]
    end
    return t1
end

function InsertLight(position, color, intensity, range, enabled, lightNum)
    setBuffer("RayMarching::positions", lightNum*16, "VEC4", position)
    setBuffer("RayMarching::colors", lightNum*16, "VEC4", color)
    setBuffer("RayMarching::intensities", lightNum*4, "FLOAT", intensity)
    setBuffer("RayMarching::maxRanges", lightNum*4, "FLOAT", range)
    setBuffer("RayMarching::enableds", lightNum*4, "BOOL", enabled)
end

function GetLight(lightNum)
    local position = {0}
    local color = {0}
    local intensity = {0}
    local range = {0}
    local enabled = {0}
    local lightName = "PointLight" .. lightNum

    getAttr("LIGHT", lightName, "POSITION", 0, position)
    getAttr("LIGHT", lightName, "COLOR", 0, color)
    getAttr("LIGHT", lightName, "LIGHT_INTENSITY", 0, intensity)
    getAttr("LIGHT", lightName, "POINT_LIGHT_MAX_RANGE", 0, range)
    getAttr("LIGHT", lightName, "ENABLED", 0, enabled)

    return position, color, intensity, range, enabled
end

lights = function()
    local position = {0}
    local color = {0}
    local intensity = {0}
    local range = {0}
    local enabled = {0}

    local numLights = 10

    for i = 1, numLights, 1 do
        position, color, intensity, range, enabled = GetLight(i)
        InsertLight(position, color, intensity, range, enabled, i-1)
    end
end