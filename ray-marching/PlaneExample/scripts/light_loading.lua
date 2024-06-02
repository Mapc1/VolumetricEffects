function TableConcat(t1,t2)
    for i=1,#t2 do
        t1[#t1+1] = t2[i]
    end
    return t1
end

function InsertLight(position, color, intensity, constAtt, linearAtt, quadAtt, enabled, lightNum)
    setBuffer("RayMarching::positions", lightNum*16, "VEC4", position)
    setBuffer("RayMarching::colors", lightNum*16, "VEC4", color)
    setBuffer("RayMarching::intensities", lightNum*4, "FLOAT", intensity)
    setBuffer("RayMarching::constAtt", lightNum*4, "FLOAT", constAtt)
    setBuffer("RayMarching::linearAtt", lightNum*4, "FLOAT", linearAtt)
    setBuffer("RayMarching::quadAtt", lightNum*4, "FLOAT", quadAtt)
    setBuffer("RayMarching::enableds", lightNum*4, "BOOL", enabled)
end

function GetLight(lightNum)
    local position = {0}
    local color = {0}
    local intensity = {0}
    local constAtt = {0}
    local linearAtt = {0}
    local quadAtt = {0}
    local enabled = {0}
    local lightName = "PointLight" .. lightNum

    getAttr("LIGHT", lightName, "POSITION", 0, position)
    getAttr("LIGHT", lightName, "COLOR", 0, color)
    getAttr("LIGHT", lightName, "LIGHT_INTENSITY", 0, intensity)
    getAttr("LIGHT", lightName, "CONSTANT_ATT", 0, constAtt)
    getAttr("LIGHT", lightName, "LINEAR_ATT", 0, linearAtt)
    getAttr("LIGHT", lightName, "QUADRATIC_ATT", 0, quadAtt)
    getAttr("LIGHT", lightName, "ENABLED", 0, enabled)

    return position, color, intensity, constAtt, linearAtt, quadAtt, enabled
end

lights = function()
    local position = {0}
    local color = {0}
    local intensity = {0}
    local constAtt = {0}
    local linearAtt = {0}
    local quadAtt = {0}
    local enabled = {0}

    local numLights = 10

    for i = 1, numLights, 1 do
        position, color, intensity, constAtt, linearAtt, quadAtt, enabled = GetLight(i)
        InsertLight(position, color, intensity, constAtt, linearAtt, quadAtt, enabled, i-1)
    end
end