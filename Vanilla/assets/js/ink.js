/* Ink transition study.
   One scroll progress, three engines. Nothing here loops on its own:
   the scene only changes when you scroll or move a control. */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mix = (a, b, t) => a + (b - a) * t;

const track = document.querySelector("[data-track]");
const stage = document.querySelector("[data-stage]");
const panelA = document.querySelector("[data-panel-a]");
const panelB = document.querySelector("[data-panel-b]");
const canvas = document.querySelector("[data-canvas]");
const controls = document.querySelector("[data-controls]");
const readout = document.querySelector("[data-progress]");
const fpsOut = document.querySelector("[data-fps]");
const engineLabel = document.querySelector("[data-engine-label]");

const svgCircle = document.getElementById("lab-ink-circle");
const svgBg = document.getElementById("lab-ink-bg");
const svgMask = document.getElementById("lab-ink-mask");
const svgTurbulence = document.getElementById("lab-ink-turbulence");
const svgDisplace = document.getElementById("lab-ink-displace");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  engine: "svg",
  angle: 90,
  softness: 12,
  grain: 8,
  warp: 70,
  ox: 0.5,
  oy: 0.7,
};

let progress = 0;
let gl = null;
let program = null;
let uniforms = {};
let glReady = false;

/* ------------------------------------------------------------------
   Progress
   ------------------------------------------------------------------ */

function metrics() {
  const rect = track.getBoundingClientRect();
  const start = rect.top + window.scrollY;
  const end = start + track.offsetHeight - window.innerHeight;
  return {
    start,
    end,
    w: stage.clientWidth,
    h: stage.clientHeight,
  };
}

function currentProgress() {
  const { start, end } = metrics();
  return clamp((window.scrollY - start) / Math.max(end - start, 1), 0, 1);
}

/* ------------------------------------------------------------------
   Engines
   ------------------------------------------------------------------ */

function setEngine(name) {
  state.engine = name;
  stage.dataset.engine = name;
  controls.dataset.engine = name;

  document.querySelectorAll("[data-engine-btn]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.engineBtn === name));
  });

  engineLabel.textContent =
    { svg: "SVG warp", webgl: "WebGL front" }[name] || name;

  panelA.style.opacity = "1";
  panelB.style.opacity = "1";

  if (name === "webgl") initGL();
  apply(progress);
}

/* The outgoing layer is only a visual. Once the hole covers it, it must not
   intercept a click or a drag-selection meant for the section underneath. */
function syncInteractivity(p) {
  const done = p >= 0.995;

  if (done) {
    panelA.style.visibility = "hidden";
    panelA.style.pointerEvents = "none";
    panelA.inert = true;
  } else {
    panelA.style.visibility = "visible";
    panelA.inert = false;
    panelA.style.pointerEvents =
      state.engine === "webgl" && p > 0.48 ? "none" : "auto";
  }

  panelB.style.pointerEvents = "auto";
}

function apply(p) {
  progress = p;
  readout.textContent = p.toFixed(2);

  if (reducedMotion) {
    panelA.style.opacity = String(1 - p);
    panelB.style.opacity = String(p);
    syncInteractivity(p);
    return;
  }

  panelA.style.opacity = "1";
  panelB.style.opacity = "1";
  panelA.style.visibility = "visible";
  panelA.inert = false;
  panelA.style.pointerEvents = "auto";

  if (state.engine === "svg") {
    const { w, h } = metrics();

    // Distance from the chosen origin to the furthest corner. The circle
    // has to cover that corner with a little room for the displacement.
    const farthest = Math.max(
      Math.hypot(state.ox * w, state.oy * h),
      Math.hypot((1 - state.ox) * w, state.oy * h),
      Math.hypot(state.ox * w, (1 - state.oy) * h),
      Math.hypot((1 - state.ox) * w, (1 - state.oy) * h)
    );

    svgMask.setAttribute("width", w);
    svgMask.setAttribute("height", h);
    svgBg.setAttribute("width", w);
    svgBg.setAttribute("height", h);
    svgCircle.setAttribute("cx", state.ox * w);
    svgCircle.setAttribute("cy", state.oy * h);
    svgCircle.setAttribute("r", p * (farthest * 1.05 + 80));
    syncInteractivity(p);
    return;
  }

  if (state.engine === "webgl") {
    const fadeIn = clamp((p - 0.5) / 0.28, 0, 1);
    const fadeOut = clamp((p - 0.22) / 0.28, 0, 1);
    panelA.style.opacity = String(1 - fadeOut);
    panelB.style.opacity = String(fadeIn);
    renderGL(p);
    syncInteractivity(p);
  }
}

/* ------------------------------------------------------------------
   WebGL
   ------------------------------------------------------------------ */

const VERTEX = `
attribute vec2 a_pos;
varying vec2 vUv;
void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uValue;
uniform float uAngle;
uniform float uSoft;
uniform float uScale;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uEdge;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float n = 0.0;
  float a = 0.54;
  for (int i = 0; i < 5; i++) {
    n += a * vnoise(p);
    p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.05 + 3.71;
    a *= 0.48;
  }
  return n;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 dir = vec2(cos(uAngle), sin(uAngle));
  float front = dot(p, dir) * 0.85 + 0.5;
  float n = fbm(p * uScale + vec2(11.3, 7.7));
  float thresh = mix(-0.22, 1.22, uValue) + (n - 0.5) * 0.38;
  float reveal = smoothstep(front - uSoft, front + uSoft, thresh);
  float d = (thresh - front) / (uSoft * 2.2 + 0.001);
  float band = exp(-d * d);
  vec3 col = mix(uA, uB, reveal);
  col = mix(col, uEdge, band * 0.10);
  float grain = (hash(gl_FragCoord.xy) - 0.5) * 0.014;
  gl_FragColor = vec4(col + grain, 1.0);
}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
  }
  return shader;
}

function initGL() {
  if (glReady) {
    resizeGL();
    return;
  }

  gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });

  if (!gl) {
    setEngine("svg");
    return;
  }

  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "link failed");
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const position = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      res: gl.getUniformLocation(program, "uRes"),
      value: gl.getUniformLocation(program, "uValue"),
      angle: gl.getUniformLocation(program, "uAngle"),
      soft: gl.getUniformLocation(program, "uSoft"),
      scale: gl.getUniformLocation(program, "uScale"),
      a: gl.getUniformLocation(program, "uA"),
      b: gl.getUniformLocation(program, "uB"),
      edge: gl.getUniformLocation(program, "uEdge"),
    };

    gl.uniform3f(uniforms.a, 0.957, 0.945, 0.918);   // #f4f1ea
    gl.uniform3f(uniforms.b, 0.059, 0.090, 0.165);   // #0f172a
    gl.uniform3f(uniforms.edge, 0.086, 0.082, 0.078);

    glReady = true;
    resizeGL();
  } catch (error) {
    console.warn("WebGL engine unavailable:", error);
    glReady = false;
    gl = null;
    setEngine("svg");
  }
}

function resizeGL() {
  if (!glReady) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2,
    Math.sqrt(2400000 / (rect.width * rect.height))
  );
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  gl.viewport(0, 0, width, height);
  gl.uniform2f(uniforms.res, width, height);
  renderGL(progress);
}

function renderGL(p) {
  if (!glReady) return;
  gl.uniform1f(uniforms.value, p);
  gl.uniform1f(uniforms.angle, (state.angle * Math.PI) / 180);
  gl.uniform1f(uniforms.soft, state.softness / 200);
  gl.uniform1f(uniforms.scale, state.grain);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/* ------------------------------------------------------------------
   Controls
   ------------------------------------------------------------------ */

document.querySelectorAll("[data-engine-btn]").forEach((button) => {
  button.addEventListener("click", () => setEngine(button.dataset.engineBtn));
});

function bindRange(selector, key, outputSelector, format, after) {
  const input = document.querySelector(selector);
  const output = outputSelector ? document.querySelector(outputSelector) : null;
  if (!input) return;

  const sync = () => {
    const value = Number(input.value);
    state[key] = key === "ox" || key === "oy" ? value / 100 : value;
    if (output) output.textContent = format ? format(value) : String(value);
    if (after) after(state[key]);
    apply(progress);
  };

  input.addEventListener("input", sync);
  sync();
}

bindRange("[data-angle]", "angle", "[data-angle-out]", (v) => `${v}°`);
bindRange("[data-softness]", "softness", "[data-softness-out]");
bindRange("[data-grain]", "grain", "[data-grain-out]", null, (value) => {
  if (!svgTurbulence) return;
  const base = 0.0022 * value + 0.001;
  svgTurbulence.setAttribute("baseFrequency", `${base.toFixed(4)} ${(base * 1.35).toFixed(4)}`);
});
bindRange("[data-warp]", "warp", "[data-warp-out]", null, (value) => {
  if (svgDisplace) svgDisplace.setAttribute("scale", value);
});
bindRange("[data-origin-x]", "ox", "[data-origin-x-out]", (v) => `${v}%`);
bindRange("[data-origin-y]", "oy", "[data-origin-y-out]", (v) => `${v}%`);

/* ------------------------------------------------------------------
   Scroll, resize, meter
   ------------------------------------------------------------------ */

let queued = false;

function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    apply(currentProgress());
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  apply(progress);
  resizeGL();
});

let lastFrame = performance.now();
const samples = [];

function meter(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  if (dt > 0 && dt < 200) {
    samples.push(1000 / dt);
    if (samples.length > 90) samples.shift();
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  fpsOut.textContent = samples.length ? `${Math.round(average)} fps` : "-- fps";
  requestAnimationFrame(meter);
}
requestAnimationFrame(meter);

/* Start. */
setEngine("svg");
apply(currentProgress());
