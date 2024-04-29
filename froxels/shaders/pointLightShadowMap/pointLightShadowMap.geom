#version 460

layout (triangles) in;
layout (triangle_strip, max_vertices=18) out;

uniform mat4 CM_P;
uniform mat4 M;

uniform vec4 LIGHT_POS;

out vec4 FragPos;

mat4[6] genMatrices(vec4 lightPos) {
    mat4 shadowMatrices[6];

    // POS X
	shadowMatrices[0] =
		mat4( 0, 0,-1, 0,
			  0,-1, 0, 0,
			  -1, 0, 0, 0,
			  lightPos.z, lightPos.y, lightPos.x, 1
  		);

	// NEG X
	shadowMatrices[1] =
		mat4( 0, 0, 1, 0,
		      0,-1, 0, 0,
			  1, 0, 0, 0,
			  -lightPos.z, lightPos.y, -lightPos.x, 1
    	);

	// POS Y
	shadowMatrices[2] =
		mat4( 1, 0, 0, 0,
	    	  0, 0,-1, 0,
		      0, 1, 0, 0,
		      -lightPos.x, -lightPos.z, lightPos.y, 1
	    );

	// NEG Y
	shadowMatrices[3] =
		mat4( 1, 0, 0, 0,
			  0, 0, 1, 0,
	          0,-1, 0, 0,
 	          -lightPos.x, lightPos.z, -lightPos.y, 1
		);

     // POS Z
	shadowMatrices[4] =
		mat4( 1, 0, 0, 0,
			  0,-1, 0, 0,
	          0, 0,-1, 0,
 	          -lightPos.x, lightPos.y, lightPos.z, 1
    	);

    // NEG Z
	shadowMatrices[5] =
		mat4( -1, 0, 0, 0,
		      0,-1, 0, 0,
			  0, 0, 1, 0,
	          lightPos.x, lightPos.y, -lightPos.z, 1
    	);

	return shadowMatrices;
}

void main() {
	mat4[6] shadowMatrices = genMatrices(LIGHT_POS);

    for (int face = 0; face < 6; ++face) {
        gl_Layer = face;
        for (int i = 0; i < 3; ++i) {
            FragPos = M * gl_in[i].gl_Position;
            gl_Position = CM_P * shadowMatrices[face] * FragPos;
            EmitVertex();
        }
        EndPrimitive();
    }
}