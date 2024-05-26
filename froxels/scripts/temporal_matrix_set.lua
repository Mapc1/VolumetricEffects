tms = function ()
    local new_prev_mat = {0}

    getAttr("CAMERA", "MainCamera", "PROJECTION_VIEW_MATRIX", 0, new_prev_mat)
    setAttr("CAMERA", "MainCamera", "PREV_PROJ_VIEW_MAT", 0, new_prev_mat)
end