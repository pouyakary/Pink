#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform sampler2D uMask;
uniform sampler2D uColorLayer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDarkMode;
uniform vec2 uHoverCenter;
uniform float uHoverRadius;
uniform float uHoverEnabled;
uniform vec3 uHoverColor;

varying vec2 vTexCoord;

const float PI = 3.141592653589793;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 gradient(vec2 cell) {
    float angle = hash(cell) * 2.0 * PI;
    return vec2(cos(angle), sin(angle));
}

float fade(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float perlinNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    vec2 g00 = gradient(i + vec2(0.0, 0.0));
    vec2 g10 = gradient(i + vec2(1.0, 0.0));
    vec2 g01 = gradient(i + vec2(0.0, 1.0));
    vec2 g11 = gradient(i + vec2(1.0, 1.0));

    vec2 d00 = f - vec2(0.0, 0.0);
    vec2 d10 = f - vec2(1.0, 0.0);
    vec2 d01 = f - vec2(0.0, 1.0);
    vec2 d11 = f - vec2(1.0, 1.0);

    float n00 = dot(g00, d00);
    float n10 = dot(g10, d10);
    float n01 = dot(g01, d01);
    float n11 = dot(g11, d11);

    vec2 u = vec2(fade(f.x), fade(f.y));

    float nx0 = mix(n00, n10, u.x);
    float nx1 = mix(n01, n11, u.x);
    float nxy = mix(nx0, nx1, u.y);

    return nxy;
}

float perlinNoise01(vec2 uv) {
    return 0.5 + 0.5 * perlinNoise(uv);
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

    if (uHoverEnabled > 0.5) {
        float safeRadius = max(uHoverRadius, 0.0001);
        vec2 pixelPos = uv * uResolution;
        float distanceToHover = distance(pixelPos, uHoverCenter);
        float normalizedDistance = clamp(distanceToHover / safeRadius, 0.0, 1.0);
        float hoverFactor = 1.0 - smoothstep(0.0, 1.0, normalizedDistance);
        hoverFactor = pow(hoverFactor, 1.4);
        baseColor = mix(baseColor, uHoverColor, hoverFactor);
    }

    vec2 pixelUV = uv * uResolution;
    vec2 sparkleTile = floor(pixelUV * 0.17);
    float sparkleSeed = hash(sparkleTile);
    float sparkleSeedB = hash(sparkleTile + vec2(19.19, 27.7));

    float twinkle = perlinNoise01(vec2(uTime * 2. + sparkleSeed * 6.3, uTime * -0.7 + sparkleSeedB * 5.1));
    float flicker = perlinNoise01(vec2(uTime * 6.0 + sparkleSeed * 4.2, uTime * -1.9 + sparkleSeedB * 3.8));

    vec2 timeScroll = vec2(uTime * 0.28, uTime * -0.24);
    vec2 swirlScroll = vec2(sin(uTime * 5.0 + sparkleSeed * 4.7), cos(uTime * 0.35 + sparkleSeedB * 5.3));
    vec2 sparkleScroll = vec2(sparkleSeed * 3.9, sparkleSeedB * 4.7);

    float grainBase = perlinNoise01(pixelUV * 0.32 + timeScroll + swirlScroll);
    float grainDetail = perlinNoise01(pixelUV * 0.83 + sparkleScroll + timeScroll * 1.3 + swirlScroll * 1.7);
    float grain = mix(grainBase, grainDetail, 0.65);

    float sparkle = smoothstep(0.5, 0.92, grain * 0.75 + twinkle * 0.35 + flicker * 0.45);
    float highlight = smoothstep(0.3, 1.0, perlinNoise01(vec2(uTime * 0.95 + sparkleSeed * 6.6, uTime * 1.15 + sparkleSeedB * 7.3)));

    vec3 sparkleLift = baseColor * (1.0 + sparkle * 0.5) + vec3(0.1) * sparkle;
    vec3 highlightLift = mix(baseColor, sparkleLift, 0.3 + 0.6 * highlight);
    float boardGlow = mix(0.05, 0.25, uDarkMode);
    vec3 glow = vec3(boardGlow * sparkleSeed * 0.7);

    vec3 color = clamp(highlightLift + glow, 0.0, 1.0);

    gl_FragColor = vec4(color, clamp(mask, 0.0, 1.0));
}
