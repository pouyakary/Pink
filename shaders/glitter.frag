#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform sampler2D uMask;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uInkColor;
uniform vec3 uSparkleColor;
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
    float mask = texture2D(uMask, vTexCoord).a;
    if (mask < 0.01) {
        discard;
    }

    vec2 uv = vTexCoord * uResolution;
    float sparkleSeed = hash(floor(uv * 0.6));
    float twinkle = sin(uTime * 6.0 + sparkleSeed * 40.0);
    float grain = noise(uv * 2.4 + twinkle);
    float sparkle = smoothstep(0.55, 1.0, max(grain, sparkleSeed));

    float highlight = smoothstep(0.75, 1.0, sin(uTime * 9.0 + sparkleSeed * 20.0) * 0.5 + 0.5);
    vec3 base = mix(uInkColor, uSparkleColor, sparkle);
    vec3 accent = mix(base, uSparkleColor, highlight);
    float boardGlow = mix(0.08, 0.25, uDarkMode);
    vec3 color = accent + vec3(boardGlow) * sparkleSeed * 0.2;

    gl_FragColor = vec4(color, clamp(mask, 0.0, 1.0));
}
