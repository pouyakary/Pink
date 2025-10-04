#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform sampler2D uMask;
uniform sampler2D uColorLayer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDarkMode;

varying vec2 vTexCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vec2 uv = vTexCoord;
    vec4 strokeSample = texture2D(uColorLayer, uv);
    float maskSample = texture2D(uMask, uv).a;
    float mask = max(strokeSample.a, maskSample);

    if (mask < 0.01) {
        discard;
    }

    vec3 baseColor = strokeSample.rgb;

    vec2 pixelUV = uv * uResolution;
    float sparkleSeed = hash(floor(pixelUV * 0.1));
    float twinkle = sin(uTime  + sparkleSeed);
    float grain = noise(pixelUV * 0.4 + twinkle);
    float sparkle = smoothstep(0.1, 1.0, max(grain, sparkleSeed));
    float highlight = smoothstep(0.5, 1.0, sin(uTime * 2.0 + sparkleSeed * 10.0) * 0.5 + 0.5);

    vec3 sparkleLift = baseColor * (1.0 + sparkle * 0.3) + vec3(0.1) * sparkle;
    vec3 highlightLift = mix(baseColor, sparkleLift, 0.3 + 0.6 * highlight);
    float boardGlow = mix(0.05, 0.25, uDarkMode);
    vec3 glow = vec3(boardGlow * sparkleSeed * 0.7);

    vec3 color = clamp(highlightLift + glow, 0.0, 1.0);

    gl_FragColor = vec4(color, clamp(mask, 0.0, 1.0));
}
