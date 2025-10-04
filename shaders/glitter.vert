#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

varying vec2 vTexCoord;

void main() {
    // Pass texture coordinates through; fragment shader handles orientation.
    vTexCoord = aTexCoord;
    // Match p5.js default transform pipeline so the quad fills the canvas.
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
