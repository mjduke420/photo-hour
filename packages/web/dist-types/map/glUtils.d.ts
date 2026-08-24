/** Thin helpers over the raw WebGL calls the shadow layer needs. */
export declare function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader;
export declare function linkProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram;
/**
 * MapLibre 4 hands a custom layer the projection matrix directly, while
 * MapLibre 5 hands it a render-arguments object. Accepting both keeps the layer
 * from being pinned to one major version.
 */
export declare function readProjectionMatrix(args: unknown): Float32Array | number[] | null;
//# sourceMappingURL=glUtils.d.ts.map