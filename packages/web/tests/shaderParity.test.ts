import { REFRACTED_EARTH_RADIUS_M, TERRARIUM_OFFSET } from "@photo-hour/shared";
import { describe, expect, it } from "vitest";
import {
  COMPOSITE_FRAGMENT_SOURCE,
  COMPOSITE_VERTEX_SOURCE,
  COMPUTE_FRAGMENT_SOURCE,
  COMPUTE_VERTEX_SOURCE,
} from "../src/map/shaders.js";

/**
 * The shadow model exists twice: in GLSL for the overlay and in TypeScript for
 * the crosshair readout and the unit tests. These checks pin the constants the
 * two share, so the pair cannot quietly drift apart.
 */
describe("shader parity with the reference model", () => {
  it("uses the same Terrarium offset as the decoder", () => {
    expect(COMPUTE_FRAGMENT_SOURCE).toContain(String(TERRARIUM_OFFSET));
  });

  it("uses the same refraction-corrected earth radius as the curvature model", () => {
    const match = /CURVE_RADIUS\s*=\s*([0-9.]+)/.exec(COMPUTE_FRAGMENT_SOURCE);
    expect(match).not.toBeNull();
    const shaderRadius = Number(match?.[1]);
    // Within a metre of the shared constant, which is all the shader needs.
    expect(Math.abs(shaderRadius - REFRACTED_EARTH_RADIUS_M)).toBeLessThan(1);
  });

  it("terminates rays against the lower limb of the solar disc", () => {
    // Testing against the upper limb would discard the penumbra entirely, which
    // is the bug the shared implementation was corrected for.
    expect(COMPUTE_FRAGMENT_SOURCE).toMatch(/tan\(lower\)\s*>\s*u_maxElevation/);
  });

  it("softens the shadow edge across the solar disc", () => {
    expect(COMPUTE_FRAGMENT_SOURCE).toContain("smoothstep(lower, upper, steepest)");
  });

  it("subtracts the curvature drop before comparing heights", () => {
    expect(COMPUTE_FRAGMENT_SOURCE).toMatch(/height\s*-\s*\(travelled \* travelled\)/);
  });

  it("treats a sun below the horizon as fully shadowed", () => {
    expect(COMPUTE_FRAGMENT_SOURCE).toMatch(/u_sunAltitude\s*<=\s*-u_discRadius/);
  });
});

describe("shader sources", () => {
  const sources = {
    COMPUTE_VERTEX_SOURCE,
    COMPUTE_FRAGMENT_SOURCE,
    COMPOSITE_VERTEX_SOURCE,
    COMPOSITE_FRAGMENT_SOURCE,
  };

  it("declare a main entry point", () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).toContain("void main()");
    }
  });

  it("stay on GLSL ES 1.00, which runs in either WebGL version", () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).not.toContain("#version");
      expect(source, name).not.toContain("gl_FragData");
    }
  });

  it("give every fragment shader an explicit precision", () => {
    expect(COMPUTE_FRAGMENT_SOURCE).toContain("precision highp float;");
    expect(COMPOSITE_FRAGMENT_SOURCE).toContain("precision mediump float;");
  });

  it("write premultiplied colour, matching the blend mode the layer sets", () => {
    expect(COMPOSITE_FRAGMENT_SOURCE).toContain("u_color * alpha, alpha");
  });

  it("pair every varying between the stages of a program", () => {
    expect(COMPUTE_VERTEX_SOURCE).toContain("varying vec2 v_uv");
    expect(COMPUTE_FRAGMENT_SOURCE).toContain("varying vec2 v_uv");
    expect(COMPOSITE_VERTEX_SOURCE).toContain("varying vec2 v_uv");
    expect(COMPOSITE_FRAGMENT_SOURCE).toContain("varying vec2 v_uv");
  });
});
