/* Hero scene — a live WebGL slot where the SVG parallax stack used to be.
 *
 * The card asked for two things in the hero: a flow-map style shader that
 * reacts to the pointer and to scroll, and a 3D object in the spot that
 * currently holds the parallax artwork. The character render isn't ready, so a
 * cube stands in. Everything a real model needs — camera, projection, pointer
 * orbit, scroll scrub, fade — is already wired, so swapping the cube for a
 * loaded mesh is a geometry change, not a rewrite.
 *
 * Two passes, one context:
 *   1. Full-screen flow field. Domain-warped contour bands; the warp is pushed
 *      by the pointer, scroll and time. This is the flow-map experiment.
 *   2. Glass cube. Ink faces with a fresnel rim plus a crisp edge wireframe.
 *
 * No libraries, no build step. If WebGL is unavailable we bail out early and
 * site.js keeps driving the original SVG parallax — that path stays intact.
 * Reduced motion gets one static frame instead of the loop.
 */

(function () {
  "use strict";

  var CONFIG = {
    camZ: 3.5,            // camera distance, in world units
    fov: 34,              // vertical field of view, degrees
    cubeScale: 1.15,
    pointerTurn: 0.55,    // radians of yaw at full pointer deflection
    pointerTilt: 0.3,     // radians of pitch at full pointer deflection
    scrollTurn: 1.15,     // radians of yaw across the hero's scroll range
    ease: 0.08,           // pointer damping, matches the SVG parallax feel
    scrollEase: 0.1,      // scroll damping, gives the scrub some weight
    spin: 0.2,            // idle radians per second
    dprCap: 2,
    ink: [0.086, 0.082, 0.078]
  };

  var container = document.querySelector("[data-hero-parallax]");
  if (!container) return;

  var canvas = container.querySelector("[data-hero-scene]");
  if (!canvas) return;

  var hero = container.closest(".hero") || container.parentElement;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "low-power"
    }) || canvas.getContext("experimental-webgl");

  if (!gl) return;

  /* ------------------------------------------------------------------ *
   * Shaders
   * ------------------------------------------------------------------ */

  var BACKGROUND_VERT = [
    "attribute vec2 a_clip;",
    "void main() {",
    "  gl_Position = vec4(a_clip, 0.0, 1.0);",
    "}"
  ].join("\n");

  // Domain-warped contour bands. swap `warp` for a flow-map texture sample
  // when you want art-directed flow instead of procedural noise.
  var BACKGROUND_FRAG = [
    "precision mediump float;",
    "uniform vec2 u_res;",
    "uniform vec2 u_mouse;",
    "uniform float u_time;",
    "uniform float u_scroll;",
    "uniform float u_fade;",
    "uniform vec3 u_ink;",
    "float hash(vec2 p) {",
    "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);",
    "}",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "float fbm(vec2 p) {",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  for (int i = 0; i < 4; i++) {",
    "    v += a * noise(p);",
    "    p *= 2.0;",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / u_res;",
    "  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);",
    "  vec2 warp = vec2(",
    "    fbm(p * 1.7 + u_time * 0.045),",
    "    fbm(p * 1.7 - u_time * 0.038 + 5.2)",
    "  );",
    "  vec2 flow = p + (warp - 0.5) * 0.9 + u_mouse * 0.14;",
    "  flow.y += u_scroll * 0.75;",
    "  float band = sin(flow.y * 21.0 + fbm(flow * 2.4) * 6.5);",
    "  float lines = smoothstep(0.9, 1.0, abs(band));",
    "  float vignette = smoothstep(1.1, 0.15, length(p));",
    "  float alpha = lines * vignette * 0.34 * u_fade;",
    "  gl_FragColor = vec4(u_ink, alpha);",
    "}"
  ].join("\n");

  var CUBE_VERT = [
    "attribute vec3 a_pos;",
    "attribute vec3 a_norm;",
    "uniform mat3 u_rot;",
    "uniform mat4 u_proj;",
    "uniform float u_scale;",
    "uniform float u_camZ;",
    "varying vec3 v_n;",
    "varying vec3 v_v;",
    "void main() {",
    "  vec3 pos = u_rot * (a_pos * u_scale);",
    "  v_n = u_rot * a_norm;",
    "  v_v = -pos;",
    "  pos.z -= u_camZ;",
    "  gl_Position = u_proj * vec4(pos, 1.0);",
    "}"
  ].join("\n");

  // u_flat > 0.5 switches the same program into the wireframe pass, which
  // keeps one draw path for faces and edges.
  var CUBE_FRAG = [
    "precision mediump float;",
    "uniform vec3 u_ink;",
    "uniform float u_fade;",
    "uniform float u_flat;",
    "varying vec3 v_n;",
    "varying vec3 v_v;",
    "void main() {",
    "  vec3 n = normalize(v_n);",
    "  vec3 v = normalize(v_v);",
    "  vec3 key = normalize(vec3(0.35, 0.75, 0.55));",
    "  float lambert = clamp(dot(n, key), 0.0, 1.0);",
    "  float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);",
    "  float shade = 0.03 + lambert * 0.07 + fresnel * 0.16;",
    "  float alpha = mix(shade, 0.62, step(0.5, u_flat)) * u_fade;",
    "  gl_FragColor = vec4(u_ink, alpha);",
    "}"
  ].join("\n");

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("hero-scene: shader failed", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function program(vertSource, fragSource) {
    var vs = compile(gl.VERTEX_SHADER, vertSource);
    var fs = compile(gl.FRAGMENT_SHADER, fragSource);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("hero-scene: link failed", gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  function uniforms(prog, names) {
    var out = {};
    for (var i = 0; i < names.length; i += 1) {
      out[names[i]] = gl.getUniformLocation(prog, names[i]);
    }
    return out;
  }

  var backgroundProg = program(BACKGROUND_VERT, BACKGROUND_FRAG);
  var cubeProg = program(CUBE_VERT, CUBE_FRAG);
  if (!backgroundProg || !cubeProg) return;

  var backgroundU = uniforms(backgroundProg, ["u_res", "u_mouse", "u_time", "u_scroll", "u_fade", "u_ink"]);
  var cubeU = uniforms(cubeProg, ["u_rot", "u_proj", "u_scale", "u_camZ", "u_ink", "u_fade", "u_flat"]);

  /* ------------------------------------------------------------------ *
   * Geometry
   * ------------------------------------------------------------------ */

  function cubeGeometry() {
    var h = 0.5;
    var faces = [
      [[1, 0, 0], [[h, -h, -h], [h, -h, h], [h, h, h], [h, h, -h]]],
      [[-1, 0, 0], [[-h, -h, -h], [-h, h, -h], [-h, h, h], [-h, -h, h]]],
      [[0, 1, 0], [[-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h]]],
      [[0, -1, 0], [[-h, -h, -h], [-h, -h, h], [h, -h, h], [h, -h, -h]]],
      [[0, 0, 1], [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]],
      [[0, 0, -1], [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]]]
    ];
    var tri = [0, 1, 2, 0, 2, 3];
    var faceVerts = [];

    for (var f = 0; f < faces.length; f += 1) {
      var n = faces[f][0];
      var quad = faces[f][1];
      for (var t = 0; t < tri.length; t += 1) {
        var v = quad[tri[t]];
        faceVerts.push(v[0], v[1], v[2], n[0], n[1], n[2]);
      }
    }

    var corners = [
      [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
      [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]
    ];
    var pairs = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    var edgeVerts = [];

    for (var e = 0; e < pairs.length; e += 1) {
      var a = corners[pairs[e][0]];
      var b = corners[pairs[e][1]];
      // Unit normal keeps normalize() sane on the flat pass.
      edgeVerts.push(a[0], a[1], a[2], 0, 0, 1, b[0], b[1], b[2], 0, 0, 1);
    }

    return {
      face: new Float32Array(faceVerts),
      edge: new Float32Array(edgeVerts)
    };
  }

  var geometry = cubeGeometry();

  var quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  var faceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, faceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.face, gl.STATIC_DRAW);

  var edgeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.edge, gl.STATIC_DRAW);

  var backgroundLoc = {
    clip: gl.getAttribLocation(backgroundProg, "a_clip")
  };
  var cubeLoc = {
    pos: gl.getAttribLocation(cubeProg, "a_pos"),
    norm: gl.getAttribLocation(cubeProg, "a_norm")
  };

  /* ------------------------------------------------------------------ *
   * Matrix helpers (column-major, mat3 + mat4 only)
   * ------------------------------------------------------------------ */

  function perspective(out, fovyDeg, aspect, near, far) {
    var f = 1 / Math.tan((fovyDeg * Math.PI) / 360);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }

  function rotation(out, yaw, pitch, roll) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cr = Math.cos(roll), sr = Math.sin(roll);
    // Rx * Ry, then a small roll about Z.
    var m11 = cy, m12 = sp * sy, m13 = -cp * sy;
    var m21 = 0, m22 = cp, m23 = sp;
    var m31 = sy, m32 = -sp * cy, m33 = cp * cy;
    out[0] = m11 * cr + m21 * sr;
    out[1] = m12 * cr + m22 * sr;
    out[2] = m13 * cr + m23 * sr;
    out[3] = -m11 * sr + m21 * cr;
    out[4] = -m12 * sr + m22 * cr;
    out[5] = -m13 * sr + m23 * cr;
    out[6] = m31;
    out[7] = m32;
    out[8] = m33;
    return out;
  }

  var proj = new Float32Array(16);
  var rot = new Float32Array(9);

  /* ------------------------------------------------------------------ *
   * Sizing
   * ------------------------------------------------------------------ */

  var width = 0;
  var height = 0;

  function resize() {
    var rect = container.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, CONFIG.dprCap);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  /* ------------------------------------------------------------------ *
   * Input state
   * ------------------------------------------------------------------ */

  var pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  var scroll = { target: 0, value: 0 };
  var elapsed = 0;

  function pointerFrom(clientX, clientY) {
    pointer.tx = (clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (clientY / window.innerHeight - 0.5) * 2;
  }

  function readScroll() {
    if (!hero) return;
    var rect = hero.getBoundingClientRect();
    var span = Math.max(rect.height, 1);
    scroll.target = Math.min(1, Math.max(0, -rect.top / span));
  }

  window.addEventListener("pointermove", function (event) {
    pointerFrom(event.clientX, event.clientY);
  }, { passive: true });

  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();
  pointerFrom(window.innerWidth * 0.5, window.innerHeight * 0.62);

  /* ------------------------------------------------------------------ *
   * Draw
   * ------------------------------------------------------------------ */

  // Which passes are live. Two flags so either layer can be switched off while
  // tuning — window.heroScene.layers.flow = false leaves just the cube.
  var layers = { flow: true, cube: true };

  function draw(dt) {
    resize();

    if (!reduceQuery.matches) {
      scroll.value += (scroll.target - scroll.value) * CONFIG.scrollEase;
      pointer.x += (pointer.tx - pointer.x) * CONFIG.ease;
      pointer.y += (pointer.ty - pointer.y) * CONFIG.ease;
      elapsed += dt;
    } else {
      scroll.value = scroll.target;
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    }

    var fade = Math.max(0, 1 - scroll.value * 1.25);
    var aspect = width / height;

    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Pass 1 — flow field.
    if (layers.flow) {
      gl.useProgram(backgroundProg);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(backgroundLoc.clip);
      gl.vertexAttribPointer(backgroundLoc.clip, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(backgroundU.u_res, width, height);
      gl.uniform2f(backgroundU.u_mouse, pointer.x, pointer.y);
      gl.uniform1f(backgroundU.u_time, elapsed);
      gl.uniform1f(backgroundU.u_scroll, scroll.value);
      gl.uniform1f(backgroundU.u_fade, fade * 0.9);
      gl.uniform3f(backgroundU.u_ink, CONFIG.ink[0], CONFIG.ink[1], CONFIG.ink[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(backgroundLoc.clip);
    }

    // Pass 2 — cube. Faces first, then edges, both without depth so the shell
    // reads as glass and every edge stays visible.
    if (!layers.cube) return;
    gl.useProgram(cubeProg);
    perspective(proj, CONFIG.fov, aspect, 0.1, 20);
    rotation(
      rot,
      -0.6 + elapsed * CONFIG.spin + pointer.x * CONFIG.pointerTurn + scroll.value * CONFIG.scrollTurn,
      0.12 + pointer.y * CONFIG.pointerTilt + scroll.value * 0.5,
      pointer.x * 0.05
    );

    gl.uniformMatrix4fv(cubeU.u_proj, false, proj);
    gl.uniformMatrix3fv(cubeU.u_rot, false, rot);
    gl.uniform1f(cubeU.u_scale, CONFIG.cubeScale);
    gl.uniform1f(cubeU.u_camZ, CONFIG.camZ);
    gl.uniform1f(cubeU.u_fade, fade);
    gl.uniform3f(cubeU.u_ink, CONFIG.ink[0], CONFIG.ink[1], CONFIG.ink[2]);

    gl.enableVertexAttribArray(cubeLoc.pos);
    gl.enableVertexAttribArray(cubeLoc.norm);

    gl.bindBuffer(gl.ARRAY_BUFFER, faceBuffer);
    gl.vertexAttribPointer(cubeLoc.pos, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(cubeLoc.norm, 3, gl.FLOAT, false, 24, 12);
    gl.uniform1f(cubeU.u_flat, 0);
    // Depth on for the shell so the near faces win and the glass stays clean.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, geometry.face.length / 6);

    // Wireframe ignores depth: all twelve edges stay visible, blueprint style.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
    gl.vertexAttribPointer(cubeLoc.pos, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(cubeLoc.norm, 3, gl.FLOAT, false, 24, 12);
    gl.uniform1f(cubeU.u_flat, 1);
    gl.drawArrays(gl.LINES, 0, geometry.edge.length / 6);

    gl.disableVertexAttribArray(cubeLoc.pos);
    gl.disableVertexAttribArray(cubeLoc.norm);
  }

  /* ------------------------------------------------------------------ *
   * Loop control — idle when offscreen or in a background tab
   * ------------------------------------------------------------------ */

  var raf = 0;
  var visible = true;
  var last = 0;

  function loop(now) {
    raf = 0;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    draw(dt);
    if (!reduceQuery.matches && visible && !document.hidden) {
      raf = window.requestAnimationFrame(loop);
    }
  }

  function start() {
    if (raf) return;
    last = 0;
    raf = window.requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0 }).observe(container);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault();
    stop();
    container.classList.remove("is-webgl");
  });

  // Hand the slot over: CSS drops the SVG layers, site.js stops moving them.
  // The flag lives on <html> as data-hero-webgl so it never collides with the
  // canvas's own data-hero-scene attribute.
  container.classList.add("is-webgl");
  document.documentElement.dataset.heroWebgl = "1";

  draw(0.016);
  start();

  // Exposed so the character render can take over without touching this file's
  // plumbing: swap the buffer in cubeGeometry(), or hand off to three.js.
  window.heroScene = {
    config: CONFIG,
    layers: layers,
    ready: true
  };
})();
