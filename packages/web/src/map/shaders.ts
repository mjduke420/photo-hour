/**
 * GLSL for the terrain shadow overlay.
 *
 * Written against GLSL ES 1.00 so the layer runs in whichever context MapLibre
 * hands us, WebGL 1 or 2.
 *
 * The work is split into two passes because a naive one-pass shader is far too
 * slow to run every frame: each shaded pixel walks up to 192 samples towards
 * the sun, which at screen resolution is hundreds of millions of texture reads.
 *
 *  1. COMPUTE renders a shadow raster into an offscreen framebuffer, aligned to
 *     the elevation tile grid in mercator space. It only re-runs when the
 *     terrain or the sun actually changes.
 *  2. COMPOSITE draws that raster over the map every frame. Because the raster
 *     is pinned to geography rather than to the screen, panning and zooming
 *     stay correct and free until the view leaves the loaded terrain.
 */

export const COMPUTE_VERTEX_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const COMPUTE_FRAGMENT_SOURCE = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_dem;
uniform vec2 u_demSize;
uniform vec2 u_demOrigin;
uniform vec2 u_demSpan;
uniform float u_maxElevation;

uniform float u_sunAltitude;
uniform vec2 u_sunDir;
uniform float u_discRadius;

uniform float u_baseStep;
uniform float u_stepGrowth;
uniform float u_maxDistance;
uniform int u_maxSteps;

const int STEP_LIMIT = 192;
const float NO_DATA = -50000.0;
const float TWO_PI = 6.283185307179586;
const float HALF_PI = 1.5707963267948966;
const float EQUATOR_M = 40075016.686;

// Earth radius scaled by 7/6 to allow for atmospheric refraction, matching
// curvatureDropMeters in the shared package.
const float CURVE_RADIUS = 7432843.6;

float decodeTerrarium(vec2 uv) {
  vec4 c = texture2D(u_dem, uv);
  return (c.r * 255.0 * 256.0 + c.g * 255.0 + c.b * 255.0 / 256.0) - 32768.0;
}

// Manual bilinear filter: the elevation is packed across three channels, so
// letting the sampler interpolate the raw bytes would produce nonsense.
float sampleHeight(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return NO_DATA;

  vec2 texel = uv * u_demSize - 0.5;
  vec2 base = floor(texel);
  vec2 frac = texel - base;
  vec2 corner = (base + 0.5) / u_demSize;
  vec2 stepU = vec2(1.0 / u_demSize.x, 0.0);
  vec2 stepV = vec2(0.0, 1.0 / u_demSize.y);

  float h00 = decodeTerrarium(corner);
  float h10 = decodeTerrarium(corner + stepU);
  float h01 = decodeTerrarium(corner + stepV);
  float h11 = decodeTerrarium(corner + stepU + stepV);

  return mix(mix(h00, h10, frac.x), mix(h01, h11, frac.x), frac.y);
}

float latitudeRadians(float mercatorY) {
  return 2.0 * atan(exp((0.5 - mercatorY) * TWO_PI)) - HALF_PI;
}

void main() {
  float originHeight = sampleHeight(v_uv);
  if (originHeight < NO_DATA + 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float upper = u_sunAltitude + u_discRadius;
  float lower = u_sunAltitude - u_discRadius;

  if (u_sunAltitude <= -u_discRadius) {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
  }

  float latitude = latitudeRadians(u_demOrigin.y + v_uv.y * u_demSpan.y);
  float metersPerMercator = EQUATOR_M * cos(latitude);

  float steepest = -HALF_PI;
  float travelled = 0.0;
  float stride = u_baseStep;

  for (int i = 0; i < STEP_LIMIT; i++) {
    if (i >= u_maxSteps) break;

    travelled += stride;
    stride *= u_stepGrowth;
    if (travelled > u_maxDistance) break;

    // Once the lower limb of the solar disc clears the highest terrain in the
    // tile, nothing further out can shade this pixel even partially.
    if (originHeight + travelled * tan(lower) > u_maxElevation) break;

    vec2 offset = u_sunDir * (travelled / metersPerMercator);
    float height = sampleHeight(v_uv + offset / u_demSpan);
    if (height < NO_DATA + 1.0) break;

    float apparent = height - (travelled * travelled) / (2.0 * CURVE_RADIUS);
    if (apparent > originHeight) {
      steepest = max(steepest, atan(apparent - originHeight, travelled));
    }
    if (steepest >= upper) break;
  }

  gl_FragColor = vec4(smoothstep(lower, upper, steepest), 0.0, 0.0, 1.0);
}
`;

export const COMPOSITE_VERTEX_SOURCE = `
attribute vec2 a_mercator;
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_mercator, 0.0, 1.0);
}
`;

export const COMPOSITE_FRAGMENT_SOURCE = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_shadow;
uniform float u_opacity;
uniform vec3 u_color;

void main() {
  float shade = texture2D(u_shadow, v_uv).r;
  float alpha = shade * u_opacity;
  // Premultiplied output, to match the blend mode the layer sets up.
  gl_FragColor = vec4(u_color * alpha, alpha);
}
`;
