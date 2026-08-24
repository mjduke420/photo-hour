/** Small numeric helpers shared by the CPU shadow model and the GLSL shader. */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function degToRad(degrees: number): number {
  return degrees * DEG;
}

export function radToDeg(radians: number): number {
  return radians * RAD;
}

/** Wraps an angle into [0, 2*PI). */
export function normalizeRadians(radians: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = radians % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

/** Wraps a compass bearing into [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** GLSL-compatible smoothstep. Returns 0 at or below edge0, 1 at or above edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
