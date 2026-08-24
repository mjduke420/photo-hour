import { describe, expect, it, vi } from "vitest";
import { compileShader, linkProgram, readProjectionMatrix } from "../src/map/glUtils.js";

/** Minimal WebGL stand-in: enough surface for compiling and linking. */
function fakeGl(overrides: Record<string, unknown> = {}) {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteProgram: vi.fn(),
    ...overrides,
  } as unknown as WebGLRenderingContext;
}

describe("compileShader", () => {
  it("uploads and compiles the source", () => {
    const gl = fakeGl();
    compileShader(gl, gl.VERTEX_SHADER, "void main() {}");
    expect(gl.shaderSource).toHaveBeenCalled();
    expect(gl.compileShader).toHaveBeenCalled();
  });

  it("raises the driver log when compilation fails", () => {
    const gl = fakeGl({
      getShaderParameter: vi.fn(() => false),
      getShaderInfoLog: vi.fn(() => "ERROR: undefined variable u_sun"),
    });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "bad")).toThrow(/undefined variable u_sun/);
  });

  it("releases the shader it could not compile", () => {
    const gl = fakeGl({ getShaderParameter: vi.fn(() => false) });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "bad")).toThrow();
    expect(gl.deleteShader).toHaveBeenCalled();
  });

  it("reports an allocation failure rather than returning nothing", () => {
    const gl = fakeGl({ createShader: vi.fn(() => null) });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "void main() {}")).toThrow(/allocate/);
  });
});

describe("linkProgram", () => {
  it("attaches both stages and links", () => {
    const gl = fakeGl();
    linkProgram(gl, "vertex", "fragment");
    expect(gl.attachShader).toHaveBeenCalledTimes(2);
    expect(gl.linkProgram).toHaveBeenCalledTimes(1);
  });

  it("raises the link log when linking fails", () => {
    const gl = fakeGl({
      getProgramParameter: vi.fn(() => false),
      getProgramInfoLog: vi.fn(() => "ERROR: varying mismatch"),
    });
    expect(() => linkProgram(gl, "vertex", "fragment")).toThrow(/varying mismatch/);
  });

  it("reports an allocation failure", () => {
    const gl = fakeGl({ createProgram: vi.fn(() => null) });
    expect(() => linkProgram(gl, "vertex", "fragment")).toThrow(/allocate/);
  });
});

describe("readProjectionMatrix", () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it("accepts a matrix passed directly", () => {
    expect(readProjectionMatrix(identity)).toBe(identity);
    const typed = new Float32Array(identity);
    expect(readProjectionMatrix(typed)).toBe(typed);
  });

  it("accepts a render arguments object", () => {
    const args = { defaultProjectionData: { mainMatrix: identity } };
    expect(readProjectionMatrix(args)).toBe(identity);
  });

  it("returns nothing it cannot use, rather than drawing with rubbish", () => {
    expect(readProjectionMatrix(null)).toBeNull();
    expect(readProjectionMatrix({})).toBeNull();
    expect(readProjectionMatrix({ defaultProjectionData: {} })).toBeNull();
  });
});
