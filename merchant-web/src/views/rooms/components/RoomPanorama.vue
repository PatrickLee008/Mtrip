<template>
  <div class="panorama">
    <canvas ref="canvas" tabindex="0" :aria-label="hint" @pointerdown="start" @pointermove="move" @pointerup="dragging = false" @pointercancel="dragging = false" @keydown="key" @wheel.prevent="zoom" />
    <span class="hint">{{ failed ? errorText : hint }}</span>
    <div class="controls"><button type="button" aria-label="Zoom in" @click="adjustZoom(-8)">+</button><button type="button" aria-label="Zoom out" @click="adjustZoom(8)">−</button><button type="button" aria-label="Reset view" @click="reset">↺</button></div>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = withDefaults(defineProps<{ src: string; hint?: string; errorText?: string }>(), { hint: 'Drag to look around · Scroll to zoom', errorText: 'Unable to display this panorama' });
const canvas = ref<HTMLCanvasElement>(); const failed = ref(false);
let gl: WebGLRenderingContext | null = null; let program: WebGLProgram | null = null; let texture: WebGLTexture | null = null; let buffer: WebGLBuffer | null = null;
let observer: ResizeObserver | undefined; let yaw = 0; let pitch = 0; let fov = 75; let dragging = false; let x = 0; let y = 0; let generation = 0;
function draw() {
  if (!gl || !program || !canvas.value) return;
  const node = canvas.value; node.width = Math.max(1, Math.round(node.clientWidth * Math.min(devicePixelRatio, 2))); node.height = Math.max(1, Math.round(node.clientHeight * Math.min(devicePixelRatio, 2)));
  gl.viewport(0, 0, node.width, node.height); gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, 'size'), node.width, node.height);
  gl.uniform3f(gl.getUniformLocation(program, 'view'), yaw, pitch, Math.tan(fov * Math.PI / 360)); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function shader(type: number, source: string) {
  const s = gl!.createShader(type)!; gl!.shaderSource(s, source); gl!.compileShader(s);
  if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { gl!.deleteShader(s); throw new Error('shader'); } return s;
}
function load() {
  const token = ++generation; failed.value = false;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (token !== generation || !gl) return;
    try {
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const scaled = document.createElement('canvas'); scaled.width = Math.min(img.width, limit); scaled.height = Math.round(img.height * scaled.width / img.width);
      scaled.getContext('2d')!.drawImage(img, 0, 0, scaled.width, scaled.height);
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scaled); draw();
    } catch { failed.value = true; }
  };
  img.onerror = () => { if (token === generation) failed.value = true; }; img.src = props.src;
}
function start(e: PointerEvent) { dragging = true; x = e.clientX; y = e.clientY; canvas.value?.setPointerCapture(e.pointerId); }
function move(e: PointerEvent) { if (!dragging) return; yaw -= (e.clientX - x) * .005; pitch = Math.max(-1.45, Math.min(1.45, pitch + (e.clientY - y) * .005)); x = e.clientX; y = e.clientY; draw(); }
function adjustZoom(delta: number) { fov = Math.max(35, Math.min(110, fov + delta)); draw(); }
function zoom(e: WheelEvent) { adjustZoom(e.deltaY * .05); }
function key(e: KeyboardEvent) { if (!e.key.startsWith('Arrow')) return; e.preventDefault(); if (e.key === 'ArrowLeft') yaw -= .1; if (e.key === 'ArrowRight') yaw += .1; if (e.key === 'ArrowUp') pitch = Math.min(1.45, pitch + .1); if (e.key === 'ArrowDown') pitch = Math.max(-1.45, pitch - .1); draw(); }
function reset() { yaw = pitch = 0; fov = 75; draw(); }
onMounted(() => {
  try {
    gl = canvas.value!.getContext('webgl'); if (!gl) throw new Error('WebGL');
    program = gl.createProgram()!;
    const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 point; void main(){gl_Position=vec4(point,0.0,1.0);}');
    // Convert a perspective ray to equirectangular UV coordinates on the sphere.
    const fragment = shader(gl.FRAGMENT_SHADER, `precision mediump float; uniform sampler2D photo; uniform vec2 size; uniform vec3 view;
      void main(){vec2 p=(gl_FragCoord.xy/size*2.0-1.0)*view.z; p.x*=size.x/size.y; vec3 d=normalize(vec3(p,1.0));
      d=vec3(d.x,d.y*cos(view.y)+d.z*sin(view.y),-d.y*sin(view.y)+d.z*cos(view.y));
      d=vec3(d.x*cos(view.x)+d.z*sin(view.x),d.y,-d.x*sin(view.x)+d.z*cos(view.x));
      vec2 uv=vec2(fract(atan(d.x,d.z)/6.2831853+0.5),0.5-asin(clamp(d.y,-1.0,1.0))/3.14159265); gl_FragColor=texture2D(photo,uv);}`);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('program');
    gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const point = gl.getAttribLocation(program, 'point'); gl.enableVertexAttribArray(point); gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    observer = new ResizeObserver(draw); observer.observe(canvas.value!); load();
  } catch { failed.value = true; }
});
watch(() => props.src, () => { if (gl) load(); });
onBeforeUnmount(() => { ++generation; observer?.disconnect(); if (gl) { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); } gl = null; });
</script>
<style scoped>
.panorama{position:relative;background:#202532;border-radius:12px;overflow:hidden;min-height:260px}.panorama canvas{display:block;width:100%;height:340px;touch-action:none;cursor:grab}.panorama canvas:active{cursor:grabbing}.hint{position:absolute;left:12px;bottom:12px;max-width:70%;color:white;background:#0008;border-radius:6px;padding:6px 10px;font-size:12px;pointer-events:none}.controls{position:absolute;right:12px;bottom:12px;display:flex;gap:4px}.controls button{border:0;border-radius:6px;background:white;width:30px;height:30px;cursor:pointer}
</style>
