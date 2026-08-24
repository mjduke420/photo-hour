/** Thin helpers over the raw WebGL calls the shadow layer needs. */

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not allocate a WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown error";
    gl.deleteShader(shader);
    throw new Error(`Shadow shader failed to compile: ${log}`);
  }
  return shader;
}

export function linkProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not allocate a WebGL program");

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown error";
    gl.deleteProgram(program);
    throw new Error(`Shadow program failed to link: ${log}`);
  }
  return program;
}

/**
 * MapLibre 4 hands a custom layer the projection matrix directly, while
 * MapLibre 5 hands it a render-arguments object. Accepting both keeps the layer
 * from being pinned to one major version.
 */
export function readProjectionMatrix(args: unknown): Float32Array | number[] | null {
  if (args instanceof Float32Array || Array.isArray(args)) return args;
  const candidate = args as { defaultProjectionData?: { mainMatrix?: number[] } } | null;
  return candidate?.defaultProjectionData?.mainMatrix ?? null;
}
