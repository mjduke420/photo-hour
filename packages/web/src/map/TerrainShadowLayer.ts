import { mercatorToLngLat, mercatorUnitsToMeters, SOLAR_DISC_RADIUS_RAD } from "@photo-hour/shared";
import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { DemTexture } from "./demStitcher.js";
import { linkProgram, readProjectionMatrix } from "./glUtils.js";
import {
  COMPOSITE_FRAGMENT_SOURCE,
  COMPOSITE_VERTEX_SOURCE,
  COMPUTE_FRAGMENT_SOURCE,
  COMPUTE_VERTEX_SOURCE,
} from "./shaders.js";

/**
 * Draft quality is used while a control is being dragged: a smaller raster and
 * fewer ray steps keep the scrubber responsive. Full quality is restored as
 * soon as the interaction ends.
 */
export type ShadowQuality = "draft" | "full";

interface QualityProfile {
  maxRasterSize: number;
  maxSteps: number;
  stepGrowth: number;
}

const PROFILES: Record<ShadowQuality, QualityProfile> = {
  draft: { maxRasterSize: 768, maxSteps: 96, stepGrowth: 1.06 },
  full: { maxRasterSize: 1536, maxSteps: 192, stepGrowth: 1.03 },
};

const MAX_RAY_DISTANCE_M = 90000;

export interface SunSettings {
  altitude: number;
  azimuth: number;
}

export interface ShadowAppearance {
  opacity: number;
  /** RGB in the range 0 to 1. */
  color: [number, number, number];
}

/**
 * Renders where terrain blocks direct sunlight, as a darkening overlay.
 *
 * The shadow raster is computed in mercator space and pinned to the elevation
 * tile grid rather than to the screen, so panning and zooming reuse it without
 * recomputing. It is rebuilt only when the terrain or the sun changes.
 */
export class TerrainShadowLayer implements CustomLayerInterface {
  readonly id = "photo-hour-terrain-shadow";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private computeProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;
  private computeQuad: WebGLBuffer | null = null;
  private compositeQuad: WebGLBuffer | null = null;
  private demGlTexture: WebGLTexture | null = null;
  private shadowGlTexture: WebGLTexture | null = null;
  private framebuffer: WebGLFramebuffer | null = null;

  private dem: DemTexture | null = null;
  private demUploaded = false;
  private rasterWidth = 0;
  private rasterHeight = 0;

  private sun: SunSettings = { altitude: 0, azimuth: 0 };
  private appearance: ShadowAppearance = { opacity: 0.55, color: [0.04, 0.06, 0.14] };
  private quality: ShadowQuality = "full";
  private needsCompute = true;

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void {
    this.map = map;
    this.computeProgram = linkProgram(gl, COMPUTE_VERTEX_SOURCE, COMPUTE_FRAGMENT_SOURCE);
    this.compositeProgram = linkProgram(gl, COMPOSITE_VERTEX_SOURCE, COMPOSITE_FRAGMENT_SOURCE);

    this.computeQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.computeQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.compositeQuad = gl.createBuffer();
    this.demGlTexture = gl.createTexture();
    this.shadowGlTexture = gl.createTexture();
    this.framebuffer = gl.createFramebuffer();

    this.demUploaded = false;
    this.rasterWidth = 0;
    this.rasterHeight = 0;
    this.needsCompute = true;
  }

  onRemove(_map: MapLibreMap, gl: WebGLRenderingContext): void {
    if (this.computeProgram) gl.deleteProgram(this.computeProgram);
    if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
    if (this.computeQuad) gl.deleteBuffer(this.computeQuad);
    if (this.compositeQuad) gl.deleteBuffer(this.compositeQuad);
    if (this.demGlTexture) gl.deleteTexture(this.demGlTexture);
    if (this.shadowGlTexture) gl.deleteTexture(this.shadowGlTexture);
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);

    this.computeProgram = null;
    this.compositeProgram = null;
    this.computeQuad = null;
    this.compositeQuad = null;
    this.demGlTexture = null;
    this.shadowGlTexture = null;
    this.framebuffer = null;
    this.map = null;
  }

  setDem(dem: DemTexture | null): void {
    this.dem = dem;
    this.demUploaded = false;
    this.invalidate();
  }

  setSun(sun: SunSettings): void {
    this.sun = sun;
    this.invalidate();
  }

  setAppearance(appearance: ShadowAppearance): void {
    this.appearance = appearance;
    // Opacity and colour are applied while compositing, so the expensive
    // ray-marched raster stays valid and only the cheap pass re-runs.
    this.map?.triggerRepaint();
  }

  setQuality(quality: ShadowQuality): void {
    if (this.quality === quality) return;
    this.quality = quality;
    this.invalidate();
  }

  private invalidate(): void {
    this.needsCompute = true;
    this.map?.triggerRepaint();
  }

  /** MapLibre calls this before the main pass, which is where the raster is built. */
  prerender(gl: WebGLRenderingContext): void {
    const dem = this.dem;
    if (!this.needsCompute || !dem) return;
    if (!this.computeProgram || !this.framebuffer) return;

    this.uploadDem(gl, dem);
    this.resizeRaster(gl, dem);
    this.runComputePass(gl, dem);
    this.needsCompute = false;
  }

  render(gl: WebGLRenderingContext, args: unknown): void {
    const program = this.compositeProgram;
    if (!this.dem || !program || !this.compositeQuad) return;
    const matrix = readProjectionMatrix(args);
    if (!matrix) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeQuad);

    const mercatorAttribute = gl.getAttribLocation(program, "a_mercator");
    const uvAttribute = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(mercatorAttribute);
    gl.vertexAttribPointer(mercatorAttribute, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvAttribute);
    gl.vertexAttribPointer(uvAttribute, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowGlTexture);
    gl.uniform1i(gl.getUniformLocation(program, "u_shadow"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_opacity"), this.appearance.opacity);
    gl.uniform3fv(gl.getUniformLocation(program, "u_color"), this.appearance.color);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, "u_matrix"),
      false,
      matrix as Float32Array,
    );

    gl.enable(gl.BLEND);
    // The fragment shader writes premultiplied colour.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private uploadDem(gl: WebGLRenderingContext, dem: DemTexture): void {
    if (this.demUploaded) return;

    gl.bindTexture(gl.TEXTURE_2D, this.demGlTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Nearest filtering is mandatory here: the sampler must not blend the
    // packed elevation bytes. Smoothing happens in the shader after decoding.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      dem.width,
      dem.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      dem.pixels,
    );

    const { originX, originY, spanX, spanY } = dem;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.compositeQuad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        originX, originY, 0, 0,
        originX + spanX, originY, 1, 0,
        originX, originY + spanY, 0, 1,
        originX + spanX, originY + spanY, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );

    this.demUploaded = true;
  }

  private resizeRaster(gl: WebGLRenderingContext, dem: DemTexture): void {
    const profile = PROFILES[this.quality];
    const factor = Math.min(1, profile.maxRasterSize / Math.max(dem.width, dem.height));
    const width = Math.max(64, Math.round(dem.width * factor));
    const height = Math.max(64, Math.round(dem.height * factor));
    if (width === this.rasterWidth && height === this.rasterHeight) return;

    gl.bindTexture(gl.TEXTURE_2D, this.shadowGlTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Linear filtering is what softens the raster back up when it is magnified.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    this.rasterWidth = width;
    this.rasterHeight = height;
  }

  private runComputePass(gl: WebGLRenderingContext, dem: DemTexture): void {
    const program = this.computeProgram;
    if (!program) return;

    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const previousViewport = gl.getParameter(gl.VIEWPORT) as Int32Array;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.shadowGlTexture,
      0,
    );
    gl.viewport(0, 0, this.rasterWidth, this.rasterHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.computeQuad);
    const positionAttribute = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.demGlTexture);

    const profile = PROFILES[this.quality];
    const centreLat = mercatorToLngLat({
      x: dem.originX + dem.spanX / 2,
      y: dem.originY + dem.spanY / 2,
    }).lat;
    const texelMeters = mercatorUnitsToMeters(dem.spanX / dem.width, centreLat);
    const baseStep = Math.max(15, texelMeters * 0.75);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1i(uniform("u_dem"), 0);
    gl.uniform2f(uniform("u_demSize"), dem.width, dem.height);
    gl.uniform2f(uniform("u_demOrigin"), dem.originX, dem.originY);
    gl.uniform2f(uniform("u_demSpan"), dem.spanX, dem.spanY);
    gl.uniform1f(uniform("u_maxElevation"), dem.maxElevation);
    gl.uniform1f(uniform("u_sunAltitude"), this.sun.altitude);
    gl.uniform2f(uniform("u_sunDir"), Math.sin(this.sun.azimuth), -Math.cos(this.sun.azimuth));
    gl.uniform1f(uniform("u_discRadius"), SOLAR_DISC_RADIUS_RAD);
    gl.uniform1f(uniform("u_baseStep"), baseStep);
    gl.uniform1f(uniform("u_stepGrowth"), profile.stepGrowth);
    gl.uniform1f(uniform("u_maxDistance"), MAX_RAY_DISTANCE_M);
    gl.uniform1i(uniform("u_maxSteps"), profile.maxSteps);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    gl.viewport(
      previousViewport[0] ?? 0,
      previousViewport[1] ?? 0,
      previousViewport[2] ?? 1,
      previousViewport[3] ?? 1,
    );
  }
}
