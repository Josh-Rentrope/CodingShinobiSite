/* Isometric technical figures.
 *
 * Everything is modelled in 3D and projected with the true isometric
 * transform from the isometric-objects skill:
 *
 *   iso(x, y, z) = [(x - y) * cos(30deg), (x + y) * 0.5 - z]
 *
 * No hand-placed screen coordinates. One unit is scaled per scene.
 * Colours come from CSS custom properties on .iso-scene, so the same
 * drawing works on warm and dark grounds.
 *
 * Parameters, per scene container:
 *   data-iso-scene="streaming|logistics|course|ar-city"
 *   data-iso-theme="light|dark"
 *   data-iso-duration="9"          loop length in seconds
 *   data-iso-hold="0.55"           phase used for the reduced-motion still
 *   data-iso-unit="26"             pixels per world unit (optional)
 *   data-iso-params='{"clients":4}' scene-specific overrides (JSON)
 *
 * The ar-city scene idles between its holographic and solid layers until the
 * pointer enters; pointer x then sets the blend and the idle resumes on leave.
 */

(() => {
  const NS = "http://www.w3.org/2000/svg";
  const C = Math.cos(Math.PI / 6);
  const S = 0.5;
  const TAU = Math.PI * 2;

  const iso = (x, y, z) => [(x - y) * C, (x + y) * S - z];
  const mod = (n, m) => ((n % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEFAULTS = {
    streaming: {
      unit: 26,
      viewBox: [900, 600],
      origin: [450, 360],
      duration: 9,
      hold: 0.55,
      clients: 4,
      packets: 4,
      speed: 3,
      packetRadius: 1.5,
      gif: "assets/img/iso/livestream.gif",
      still: "assets/img/iso/livestream-still.webp",
    },
    logistics: {
      unit: 30,
      viewBox: [960, 680],
      origin: [480, 380],
      duration: 12,
      hold: 0.42,
      trees: 4,
      seed: 7,
      fadeIn: 0.18,
      lightGreen: 0.52,
      clearX: 1.4,
      endFront: 9,
      startX: -9.4,
      truckFront: 4.35,
    },
    course: {
      unit: 46,
      viewBox: [900, 680],
      origin: [450, 370],
      duration: 10,
      hold: 0.25,
      options: 4,
    },
    "ar-city": {
      unit: 24,
      viewBox: [900, 660],
      origin: [450, 400],
      duration: 14,
      hold: 0.5,
      buildings: 6,
      holoBlend: 1,
      glitch: true,
      idle: true,
      idleDepth: 0.68,
      idleDelay: 1600,
      seed: 11,
    },
  };

  class IsoScene {
    static count = 0;

    constructor(root) {
      this.root = root;
      this.type = root.dataset.isoScene;
      const base = DEFAULTS[this.type];
      this.cfg = { ...base, ...safeJSON(root.dataset.isoParams) };
      this.unit = Number(root.dataset.isoUnit || this.cfg.unit);
      this.view = this.cfg.viewBox;
      this.origin = this.cfg.origin;
      this.duration = Number(root.dataset.isoDuration || this.cfg.duration);
      this.hold = Number(root.dataset.isoHold || this.cfg.hold);
      this.theme = root.dataset.isoTheme || "light";
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.holoBlend = this.cfg.holoBlend ?? 1;
      this.glitch = this.cfg.glitch !== false;
      this.idleAllowed = this.type === "ar-city" && this.cfg.idle !== false;
      this.idle = this.idleAllowed && !this.reduced;
      this.idleAmount = this.idle ? 1 : 0;
      this.idleDepth = this.cfg.idleDepth ?? 0.68;
      this.idleDelay = this.cfg.idleDelay ?? 1600;
      this.idleTimer = null;
      this.lastPhase = 0;
      this.uid = `${this.type}-${IsoScene.count++}`;
      this.dyn = {};
      this.visible = false;
      this.started = false;
      this.svg = document.createElementNS(NS, "svg");
      this.svg.setAttribute("viewBox", `0 0 ${this.view[0]} ${this.view[1]}`);
      this.svg.setAttribute("aria-hidden", "true");
      this.svg.setAttribute("focusable", "false");
      root.append(this.svg);
      this.build();
      this.applyReduced();
      this.render(0);
      if (root.dataset.isoFit !== "false") this.fitView();
      this.wireControls();
      root.classList.toggle("is-idle", this.idle);
      root.__iso = this;
    }

    /* ---------------------------------------------------------------
       Projection and primitives
       --------------------------------------------------------------- */

    P(x, y, z) {
      const [sx, sy] = iso(x, y, z);
      return [this.origin[0] + sx * this.unit, this.origin[1] + sy * this.unit];
    }

    pts(points) {
      return points
        .map(([x, y, z]) => {
          const [sx, sy] = this.P(x, y, z);
          return `${sx.toFixed(2)},${sy.toFixed(2)}`;
        })
        .join(" ");
    }

    poly(points, cls, extra = "") {
      return `<polygon points="${this.pts(points)}" class="${cls}" ${extra}/>`;
    }

    line(a, b, cls, extra = "") {
      const [x1, y1] = this.P(...a);
      const [x2, y2] = this.P(...b);
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="${cls}" ${extra}/>`;
    }

    polyline(points, cls, extra = "") {
      return `<polyline points="${this.pts(points)}" class="${cls}" ${extra}/>`;
    }

    ellipseAt(x, y, z, rx, ry, cls, extra = "") {
      const [cx, cy] = this.P(x, y, z);
      return `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" class="${cls}" ${extra}/>`;
    }

    topRect(x, y, z, w, d, cls) {
      return this.poly(
        [
          [x, y, z],
          [x + w, y, z],
          [x + w, y + d, z],
          [x, y + d, z],
        ],
        cls
      );
    }

    box(x, y, z, w, d, h, opts = {}) {
      const top = opts.top || "iso-top";
      const left = opts.left || "iso-left";
      const right = opts.right || "iso-right";
      const detail = opts.details || "";
      const highlight =
        opts.highlight === false
          ? ""
          : this.line([x + w, y, z + h], [x + w, y + d, z + h], "iso-highlight");
      return (
        `<g class="${opts.cls || ""}">` +
        this.poly(
          [
            [x, y, z + h],
            [x + w, y, z + h],
            [x + w, y + d, z + h],
            [x, y + d, z + h],
          ],
          top
        ) +
        this.poly(
          [
            [x, y + d, z + h],
            [x + w, y + d, z + h],
            [x + w, y + d, z],
            [x, y + d, z],
          ],
          left
        ) +
        this.poly(
          [
            [x + w, y, z + h],
            [x + w, y + d, z + h],
            [x + w, y + d, z],
            [x + w, y, z],
          ],
          right
        ) +
        highlight +
        detail +
        `</g>`
      );
    }

    cyl(cx, cy, z, r, h, top = "iso-top", side = "iso-left", n = 22) {
      const ring = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      const topPts = ring.map(([x, y]) => [x, y, z + h]);
      const botPts = ring.map(([x, y]) => [x, y, z]);
      return this.poly([...topPts, ...botPts.slice().reverse()], side) + this.poly(topPts, top);
    }

    rightPanel(x, y, z, w, d, h, u0, v0, u1, v1, cls, extra = "") {
      return this.poly(
        [
          [x + w, y + u0, z + v0],
          [x + w, y + u1, z + v0],
          [x + w, y + u1, z + v1],
          [x + w, y + u0, z + v1],
        ],
        cls,
        extra
      );
    }

    leftPanel(x, y, z, w, d, h, u0, v0, u1, v1, cls, extra = "") {
      return this.poly(
        [
          [x + u0, y + d, z + v0],
          [x + u1, y + d, z + v0],
          [x + u1, y + d, z + v1],
          [x + u0, y + d, z + v1],
        ],
        cls,
        extra
      );
    }

    windowsRight(x, y, z, w, d, h, cols, rows, u0, v0, u1, v1, cls = "iso-window") {
      const uw = (u1 - u0) / cols;
      const vh = (v1 - v0) / rows;
      let out = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out += this.rightPanel(
            x, y, z, w, d, h,
            u0 + c * uw + uw * 0.22,
            v0 + r * vh + vh * 0.22,
            u0 + (c + 1) * uw - uw * 0.22,
            v0 + (r + 1) * vh - vh * 0.22,
            cls
          );
        }
      }
      return out;
    }

    windowsLeft(x, y, z, w, d, h, cols, rows, u0, v0, u1, v1, cls = "iso-window") {
      const uw = (u1 - u0) / cols;
      const vh = (v1 - v0) / rows;
      let out = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out += this.leftPanel(
            x, y, z, w, d, h,
            u0 + c * uw + uw * 0.22,
            v0 + r * vh + vh * 0.22,
            u0 + (c + 1) * uw - uw * 0.22,
            v0 + (r + 1) * vh - vh * 0.22,
            cls
          );
        }
      }
      return out;
    }

    screenImage(x, y, z, w, d, h, u0, v0, u1, v1, href) {
      // On the +x face the viewer's left-to-right runs from +y to 0,
      // so the image's left edge is at u1 and its right edge at u0.
      const p0 = [x + w, y + u1, z + v0];
      const p1 = [x + w, y + u0, z + v0];
      const p2 = [x + w, y + u0, z + v1];
      const p3 = [x + w, y + u1, z + v1];
      const [ax, ay] = this.P(...p0);
      const [bx, by] = this.P(...p1);
      const [dx, dy] = this.P(...p3);
      const iw = 160;
      const ih = 90;
      const a = (bx - ax) / iw;
      const b = (by - ay) / iw;
      const c = (dx - ax) / ih;
      const dm = (dy - ay) / ih;
      this.screenCount = (this.screenCount || 0) + 1;
      const id = this.uid + "-screen-" + this.screenCount;
      return (
        `<clipPath id="${id}"><polygon points="${this.pts([p0, p1, p2, p3])}"/></clipPath>` +
        `<image x="0" y="0" width="${iw}" height="${ih}" data-gif="${this.cfg.gif}" data-still="${this.cfg.still}" href="${this.reduced ? this.cfg.still : href}" preserveAspectRatio="none" clip-path="url(#${id})" transform="matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${dm.toFixed(4)} ${ax.toFixed(2)} ${ay.toFixed(2)})"/>`
      );
    }

    cable(a, b, c, segments = 18) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const u = 1 - t;
        pts.push([
          u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
          u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
          u * u * a[2] + 2 * u * t * b[2] + t * t * c[2],
        ]);
      }
      return { markup: this.polyline(pts, "iso-detail"), points: pts };
    }

    pointOnPath(points, u) {
      const t = Math.max(0, Math.min(1, u)) * (points.length - 1);
      const i = Math.floor(t);
      const f = t - i;
      const a = points[i];
      const b = points[Math.min(i + 1, points.length - 1)];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }

    shadow(x, y, z, rx, ry) {
      return this.ellipseAt(x, y, z, rx, ry, "iso-shadow");
    }

    screw(x, y, z) {
      const [cx, cy] = this.P(x, y, z);
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="1.2" class="iso-screw"/>`;
    }

    /* ---------------------------------------------------------------
       Scene: streaming server
       --------------------------------------------------------------- */

    buildStreaming() {
      const cfg = this.cfg;
      const clients = Math.max(2, Math.min(6, cfg.clients));
      const spots = [
        [-5.6, -4.2],
        [-5.6, 4.2],
        [5.6, -4.2],
        [5.6, 4.2],
        [-5.6, 0],
        [5.6, 0],
      ].slice(0, clients);

      let base = this.box(-8, -8, -0.55, 16, 16, 0.55, {
        top: "iso-ground",
        highlight: false,
      });
      base += this.topRect(-7.6, -7.6, 0, 15.2, 15.2, "iso-detail");
      base += this.screw(-7.4, -7.4, 0) + this.screw(7.4, -7.4, 0);
      base += this.screw(-7.4, 7.4, 0) + this.screw(7.4, 7.4, 0);
      base += this.shadow(0, 0, 0, 2.4, 1.1);

      let cables = "";
      let packets = "";
      const packetDefs = [];
      spots.forEach(([cx, cy], i) => {
        const a = [cx, cy, 0.12];
        const b = [cx * 0.35, cy * 0.35, 0.02];
        const c = [0.62, 0.42, 0.95];
        const cable = this.cable(a, b, c);
        cables += cable.markup;
        for (let k = 0; k < cfg.packets; k++) {
          packetDefs.push({
            path: cable.points,
            offset: (i * 0.13 + k * (1 / cfg.packets)) % 1,
          });
          packets += `<circle r="${cfg.packetRadius}" class="iso-packet" data-packet="${packetDefs.length - 1}"/>`;
        }
      });

      let serverDetails =
        this.rightPanel(-1.1, -0.9, 0, 2.2, 1.8, 3.2, 0.18, 0.22, 1.62, 0.8, "iso-screen-field") +
        this.rightPanel(-1.1, -0.9, 0, 2.2, 1.8, 3.2, 0.18, 0.95, 1.62, 1.5, "iso-screen-field") +
        this.rightPanel(-1.1, -0.9, 0, 2.2, 1.8, 3.2, 0.18, 1.65, 1.62, 2.18, "iso-screen-field") +
        this.rightPanel(-1.1, -0.9, 0, 2.2, 1.8, 3.2, 0.18, 2.32, 1.62, 2.76, "iso-screen-field");
      for (let i = 0; i < 4; i++) {
        serverDetails += this.line([1.1, -0.5, 2.4 + i * 0.075], [1.1, 0.5, 2.4 + i * 0.075], "iso-detail");
        serverDetails += this.rightPanel(-1.1, -0.9, 0, 2.2, 1.8, 3.2, 0.35 + i * 0.3, 2.96, 0.45 + i * 0.3, 3.06, "iso-led", `data-led="${i}"`);
      }
      const server =
        this.box(-1.1, -0.9, 0, 2.2, 1.8, 3.2, {
          highlight: true,
          details: serverDetails,
        }) +
        this.box(-0.06, -0.06, 3.2, 0.12, 0.12, 0.55, { highlight: false }) +
        this.ellipseAt(-0.06, -0.06, 3.82, 2.4, 1.1, "iso-accent-fill");

      let objects = [{ key: 0, markup: server }];
      spots.forEach(([cx, cy]) => {
        const desk =
          this.box(cx - 0.7, cy - 1.1, 0.75, 1.4, 2.2, 0.16, { highlight: true }) +
          this.box(cx - 0.66, cy - 1.04, 0, 0.12, 0.12, 0.75, { highlight: false }) +
          this.box(cx + 0.54, cy - 1.04, 0, 0.12, 0.12, 0.75, { highlight: false }) +
          this.box(cx - 0.66, cy + 0.92, 0, 0.12, 0.12, 0.75, { highlight: false }) +
          this.box(cx + 0.54, cy + 0.92, 0, 0.12, 0.12, 0.75, { highlight: false });
        const monitor =
          this.box(cx - 0.06, cy - 0.9, 1.05, 0.12, 1.8, 1.05, {
            highlight: true,
            details:
              this.rightPanel(cx - 0.06, cy - 0.9, 1.05, 0.12, 1.8, 1.05, 0.14, 0.09, 1.66, 0.96, "iso-screen-field") +
              this.screenImage(cx - 0.06, cy - 0.9, 1.05, 0.12, 1.8, 1.05, 0.2, 0.14, 1.6, 0.91, this.cfg.gif) +
              this.line([cx + 0.06, cy - 0.82, 2.0], [cx + 0.06, cy + 0.82, 2.0], "iso-highlight"),
          }) +
          this.box(cx - 0.03, cy - 0.07, 0.9, 0.06, 0.14, 0.16, { highlight: false });
        const keyboard = this.box(cx + 0.14, cy - 0.38, 0.91, 0.5, 0.76, 0.04, {
          highlight: false,
          details:
            this.line([cx + 0.2, cy - 0.28, 0.95], [cx + 0.58, cy - 0.28, 0.95], "iso-detail") +
            this.line([cx + 0.2, cy - 0.12, 0.95], [cx + 0.58, cy - 0.12, 0.95], "iso-detail") +
            this.line([cx + 0.2, cy + 0.04, 0.95], [cx + 0.58, cy + 0.04, 0.95], "iso-detail"),
        });
        const tower = this.box(cx - 0.5, cy + 0.5, 0, 0.38, 0.5, 0.62, {
          highlight: false,
          details: this.rightPanel(cx - 0.5, cy + 0.5, 0, 0.38, 0.5, 0.62, 0.1, 0.12, 0.4, 0.5, "iso-detail"),
        });
        objects.push({
          key: cx + cy,
          markup: `<g class="iso-client">${desk}${tower}${monitor}${keyboard}</g>`,
        });
      });
      objects.sort((a, b) => a.key - b.key);

      const defs = `<defs><radialGradient id="${this.uid}-led"><stop offset="0" stop-color="var(--iso-accent)"/><stop offset="1" stop-color="var(--iso-accent)" stop-opacity="0"/></radialGradient></defs>`;
      const markup =
        defs +
        base +
        cables +
        `<g class="iso-packets">${packets}</g>` +
        objects.map((o) => o.markup).join("");

      this.svg.innerHTML = markup;
      this.packetDefs = packetDefs;
      this.dyn.packets = [...this.svg.querySelectorAll("[data-packet]")];
      this.dyn.leds = [...this.svg.querySelectorAll("[data-led]")];
      this.dyn.screens = [...this.svg.querySelectorAll("image[data-gif]")];
      this.render = (phase) => {
        const p = mod(phase, 1);
        this.dyn.packets.forEach((el, i) => {
          const def = this.packetDefs[i];
          const t = mod(p * cfg.speed + def.offset, 1);
          const u = 1 - Math.abs(2 * t - 1);
          const [x, y] = this.P(...this.pointOnPath(def.path, u));
          el.setAttribute("cx", x.toFixed(2));
          el.setAttribute("cy", y.toFixed(2));
        });
        this.dyn.leds.forEach((el, i) => {
          const on = Math.sin(TAU * (p * 3 + i * 0.23)) > 0.15;
          el.classList.toggle("is-on", on);
        });
      };
    }

    /* ---------------------------------------------------------------
       Scene: logistics intersection
       --------------------------------------------------------------- */

    buildLogistics() {
      const cfg = this.cfg;
      const rand = mulberry32(cfg.seed);
      const road = 2.8;
      let base = this.box(-9, -9, -0.6, 18, 18, 0.6, {
        top: "iso-ground",
        highlight: false,
      });
      base += this.topRect(-8.6, -8.6, 0, 17.2, 17.2, "iso-detail");
      base += this.screw(-8.4, -8.4, 0) + this.screw(8.4, -8.4, 0);
      base += this.screw(-8.4, 8.4, 0) + this.screw(8.4, 8.4, 0);

      let ground = "";
      ground += this.topRect(-9, -road / 2, 0, 18, road, "iso-road");
      ground += this.topRect(-road / 2, -9, 0, road, 18, "iso-road");
      ground += this.topRect(-9, -road / 2 - 0.55, 0, 18, 0.55, "iso-left");
      ground += this.topRect(-9, road / 2, 0, 18, 0.55, "iso-left");
      ground += this.topRect(-road / 2 - 0.55, -9, 0, 0.55, 18, "iso-left");
      ground += this.topRect(road / 2, -9, 0, 0.55, 18, "iso-left");

      for (let x = -8.3; x < 8.3; x += 1.7) {
        if (Math.abs(x) < 2.2) continue;
        ground += this.topRect(x, -0.06, 0, 0.75, 0.12, "iso-road-line");
      }
      for (let y = -8.3; y < 8.3; y += 1.7) {
        if (Math.abs(y) < 2.2) continue;
        ground += this.topRect(-0.06, y, 0, 0.12, 0.75, "iso-road-line");
      }
      for (let i = 0; i < 5; i++) {
        ground += this.topRect(-2.35, -1.2 + i * 0.52, 0, 0.42, 0.24, "iso-road-line");
        ground += this.topRect(1.93, -1.2 + i * 0.52, 0, 0.42, 0.24, "iso-road-line");
      }
      ground += this.topRect(-2.08, -1.3, 0, 0.13, 2.6, "iso-road-line");

      let objects = [];
      const treeSpots = [
        [-5.6, -5.6],
        [5.6, -5.6],
        [-5.6, 5.6],
        [5.6, 5.6],
      ].slice(0, cfg.trees);
      treeSpots.forEach(([x, y]) => {
        const s = 0.86 + rand() * 0.3;
        const tree =
          this.box(x - 0.55, y - 0.55, 0, 1.1, 1.1, 0.22, { highlight: false }) +
          this.box(x - 0.12, y - 0.12, 0.22, 0.24, 0.24, 1.0, { highlight: false }) +
          this.cyl(x, y, 1.16, 0.82 * s, 1.24 * s, "iso-foliage-top", "iso-foliage-side") +
          this.shadow(x, y, 0, 0.9, 0.4);
        objects.push({ key: x + y, markup: tree });
      });

      const lights = [2.35, 2.35, -2.35, -2.35];
      const lightSpots = [
        [lights[0], lights[1]],
        [lights[2], lights[3]],
      ];
      lightSpots.forEach(([x, y]) => {
        const pole =
          this.box(x - 0.08, y - 0.08, 0, 0.16, 0.16, 2.3, { highlight: false }) +
          this.box(x - 0.25, y - 0.18, 2.3, 0.5, 0.36, 0.9, {
            highlight: true,
            details:
              this.rightPanel(x - 0.25, y - 0.18, 2.3, 0.5, 0.36, 0.9, 0.12, 0.1, 0.24, 0.25, "iso-lamp iso-lamp-red", 'data-lamp="red"') +
              this.rightPanel(x - 0.25, y - 0.18, 2.3, 0.5, 0.36, 0.9, 0.12, 0.36, 0.24, 0.51, "iso-lamp iso-lamp-amber", 'data-lamp="amber"') +
              this.rightPanel(x - 0.25, y - 0.18, 2.3, 0.5, 0.36, 0.9, 0.12, 0.62, 0.24, 0.77, "iso-lamp iso-lamp-green", 'data-lamp="green"'),
          }) +
          this.shadow(x, y, 0, 0.45, 0.2);
        objects.push({ key: x + y, markup: pole });
      });

      const truck =
        `<g data-truck>` +
        this.shadow(3.3, 0.55, 0, 2.4, 0.9) +
        this.box(0, 0, 0.25, 3.2, 1.25, 1.55, {
          highlight: true,
          details:
            this.leftPanel(0, 0, 0.25, 3.2, 1.25, 1.55, 0.18, 0.28, 3.02, 1.28, "iso-detail") +
            this.leftPanel(0, 0, 0.25, 3.2, 1.25, 1.55, 0.18, 0.36, 3.02, 0.42, "iso-highlight"),
        }) +
        this.box(3.2, 0.05, 0.25, 1.15, 1.15, 1.15, {
          highlight: true,
          details:
            this.rightPanel(3.2, 0.05, 0.25, 1.15, 1.15, 1.15, 0.12, 0.38, 1.03, 0.98, "iso-screen-field") +
            this.rightPanel(3.2, 0.05, 0.25, 1.15, 1.15, 1.15, 0.08, 0.08, 0.2, 0.2, "iso-accent-fill"),
        }) +
        this.ellipseAt(0.6, 1.26, 0.55, 7.5, 4.2, "iso-wheel") +
        this.ellipseAt(2.05, 1.26, 0.55, 7.5, 4.2, "iso-wheel") +
        this.ellipseAt(3.75, 1.2, 0.55, 7.5, 4.2, "iso-wheel") +
        `</g>`;
      objects.push({ key: 20, markup: truck });

      objects.sort((a, b) => a.key - b.key);
      const markup =
        base +
        ground +
        objects.map((o) => o.markup).join("");
      this.svg.innerHTML = markup;
      this.dyn.truck = this.svg.querySelector("[data-truck]");
      this.dyn.lamps = [...this.svg.querySelectorAll("[data-lamp]")];
      this.render = (phase) => {
        const p = mod(phase, 1);
        const go = cfg.lightGreen;
        const stopX = -2.08 - cfg.truckFront;
        const endX = cfg.endFront - cfg.truckFront;
        const clearX = cfg.clearX;
        const travel = (clearX - stopX) + (endX - clearX);
        const clearPhase = go + (1 - go) * ((clearX - stopX) / travel);
        let x;
        let opacity;
        if (p < cfg.fadeIn) {
          x = lerp(cfg.startX, stopX, smooth(p / cfg.fadeIn));
          opacity = p / cfg.fadeIn;
        } else if (p < go) {
          x = stopX;
          opacity = 1;
        } else if (p < clearPhase) {
          x = lerp(stopX, clearX, (p - go) / (clearPhase - go));
          opacity = 1;
        } else {
          const t = (p - clearPhase) / (1 - clearPhase);
          x = lerp(clearX, endX, t);
          opacity = 1 - t;
        }
        const [tx, ty] = this.P(x, 0, 0);
        const [ox, oy] = this.P(0, 0, 0);
        this.dyn.truck.setAttribute("transform", `translate(${(tx - ox).toFixed(2)} ${(ty - oy).toFixed(2)})`);
        this.dyn.truck.style.opacity = opacity.toFixed(3);
        const green = p >= go;
        const amber = !green && p >= go - 0.04;
        this.dyn.lamps.forEach((el) => {
          const kind = el.dataset.lamp;
          el.classList.toggle("is-on", kind === "green" ? green : kind === "amber" ? amber : !green && !amber);
        });
      };
    }

    /* ---------------------------------------------------------------
       Scene: course platform
       --------------------------------------------------------------- */

    buildCourse() {
      const cfg = this.cfg;
      const options = Math.max(2, Math.min(5, cfg.options));
      const deskZ = 1.05;
      let base = this.box(-5.5, -4.5, -0.5, 11, 9, 0.5, {
        top: "iso-ground",
        highlight: false,
      });
      base += this.topRect(-5.1, -4.1, 0, 10.2, 8.2, "iso-detail");
      base += this.screw(-4.9, -3.9, 0) + this.screw(4.9, -3.9, 0);
      base += this.screw(-4.9, 3.9, 0) + this.screw(4.9, 3.9, 0);

      const desk =
        this.box(-2.6, -1.2, deskZ, 5.2, 3.6, 0.18, { highlight: true }) +
        this.box(-2.5, -1.1, 0, 0.14, 0.14, deskZ, { highlight: false }) +
        this.box(2.36, -1.1, 0, 0.14, 0.14, deskZ, { highlight: false }) +
        this.box(-2.5, 2.26, 0, 0.14, 0.14, deskZ, { highlight: false }) +
        this.box(2.36, 2.26, 0, 0.14, 0.14, deskZ, { highlight: false });

      const monitorZ = deskZ + 0.18;
      let screenDetails =
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.08, 1.72, 2.92, 1.82, "iso-screen-line") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.18, 0.28, 1.45, 1.58, "iso-screen-field") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 1.55, 0.28, 2.82, 1.58, "iso-screen-field") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.28, 1.3, 1.35, 1.48, "iso-screen-field") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.28, 1.02, 1.35, 1.2, "iso-screen-field") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.28, 0.74, 1.35, 0.92, "iso-screen-field") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 0.28, 0.38, 1.0, 0.62, "iso-accent-fill") +
        this.rightPanel(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, 1.62, 1.3, 2.72, 1.56, "iso-screen-line") +
        this.line([-0.46, -0.68, monitorZ + 1.34], [-0.46, -0.68, monitorZ + 1.42], "iso-accent-line", 'data-cursor');
      for (let i = 0; i < options; i++) {
        screenDetails += this.rightPanel(
          -0.6, -1.0, monitorZ, 0.14, 3.0, 1.9,
          1.62, 1.12 - i * 0.17, 2.72, 1.25 - i * 0.17,
          "iso-quiz-option", `data-option="${i}"`
        );
      }
      const monitor =
        this.box(-0.6, -1.0, monitorZ, 0.14, 3.0, 1.9, {
          highlight: true,
          details: screenDetails,
        }) +
        this.box(-0.18, -0.18, deskZ, 0.36, 0.36, monitorZ - deskZ, { highlight: false });

      const keyboard =
        this.box(0.1, -0.5, deskZ + 0.18, 0.9, 1.0, 0.05, {
          highlight: false,
          details:
            this.line([0.2, -0.35, deskZ + 0.24], [0.9, -0.35, deskZ + 0.24], "iso-detail") +
            this.line([0.2, -0.1, deskZ + 0.24], [0.9, -0.1, deskZ + 0.24], "iso-detail") +
            this.line([0.2, 0.15, deskZ + 0.24], [0.9, 0.15, deskZ + 0.24], "iso-detail"),
        }) +
        this.cyl(1.74, 1.49, deskZ + 0.18, 0.14, 0.28, "iso-top", "iso-left") +
        this.line([1.88, 1.49, deskZ + 0.32], [1.94, 1.49, deskZ + 0.32], "iso-detail");

      this.svg.innerHTML = base + desk + keyboard + monitor;
      this.dyn.options = [...this.svg.querySelectorAll("[data-option]")];
      this.dyn.cursor = this.svg.querySelector("[data-cursor]");
      this.render = (phase) => {
        const p = mod(phase, 1);
        this.lastPhase = p;
        const active = Math.floor(mod(p * options, options));
        this.dyn.options.forEach((el, i) => el.classList.toggle("is-active", i === active));
        const blink = mod(p * 8, 1) < 0.5;
        this.dyn.cursor.style.opacity = blink ? "1" : "0";
      };
    }

    /* ---------------------------------------------------------------
       Scene: AR city twins
       --------------------------------------------------------------- */

    buildArCity() {
      const cfg = this.cfg;
      const rand = mulberry32(cfg.seed);
      let base = this.box(-9, -9, -0.6, 18, 18, 0.6, {
        top: "iso-ground",
        highlight: false,
      });
      base += this.topRect(-8.6, -8.6, 0, 17.2, 17.2, "iso-detail");
      base += this.screw(-8.4, -8.4, 0) + this.screw(8.4, -8.4, 0);
      base += this.screw(-8.4, 8.4, 0) + this.screw(8.4, 8.4, 0);

      let street = "";
      street += this.topRect(-9, -1.5, 0, 18, 3.0, "iso-road");
      street += this.topRect(-9, -2.1, 0, 18, 0.6, "iso-left");
      street += this.topRect(-9, 1.5, 0, 18, 0.6, "iso-left");
      for (let x = -8.4; x < 8.4; x += 1.6) {
        if (Math.abs(x) < 1.5) continue;
        street += this.topRect(x, -0.06, 0, 0.7, 0.12, "iso-road-line");
      }
      for (let i = 0; i < 6; i++) {
        street += this.topRect(-2.2, -1.3 + i * 0.44, 0, 0.5, 0.2, "iso-road-line");
        street += this.topRect(1.7, -1.3 + i * 0.44, 0, 0.5, 0.2, "iso-road-line");
      }

      let objects = [];

      const rows = [
        { y: -7.0 },
        { y: 2.8 },
      ];
      const spots = [];
      let x = -7.6;
      for (let i = 0; i < cfg.buildings; i++) {
        const w = 2.2 + rand() * 0.9;
        const d = 3.8 + rand() * 0.8;
        const h = 3.2 + rand() * 3.4;
        const row = i % 2 === 0 ? rows[0] : rows[1];
        spots.push({ x, y: row.y, w, d, h, i });
        x += w + 0.45;
        if (x > 7.6) break;
      }

      spots.forEach((b, i) => {
        const solidWindows =
          this.windowsRight(b.x, b.y, 0, b.w, b.d, b.h, 3, 4, 0.18, 0.18, b.d - 0.18, b.h - 0.18, "iso-window") +
          this.windowsLeft(b.x, b.y, 0, b.w, b.d, b.h, 3, 4, 0.18, 0.18, b.w - 0.18, b.h - 0.18, "iso-window");
        const holoWindows =
          this.windowsRight(b.x, b.y, 0, b.w, b.d, b.h, 3, 4, 0.18, 0.18, b.d - 0.18, b.h - 0.18, "iso-holo-line") +
          this.windowsLeft(b.x, b.y, 0, b.w, b.d, b.h, 3, 4, 0.18, 0.18, b.w - 0.18, b.h - 0.18, "iso-holo-line");

        const solidRoof =
          this.box(b.x + b.w * 0.2, b.y + b.d * 0.2, b.h, 0.7, 0.7, 0.45, { highlight: false }) +
          (i === 3
            ? this.cyl(b.x + b.w * 0.62, b.y + b.d * 0.55, b.h, 0.42, 0.7, "iso-top", "iso-left") +
              this.box(b.x + b.w * 0.62 - 0.38, b.y + b.d * 0.55 - 0.38, b.h, 0.12, 0.12, 0.6, { highlight: false }) +
              this.box(b.x + b.w * 0.62 + 0.26, b.y + b.d * 0.55 + 0.26, b.h, 0.12, 0.12, 0.6, { highlight: false })
            : "");
        const holoRoof =
          this.box(b.x + b.w * 0.2, b.y + b.d * 0.2, b.h, 0.7, 0.7, 0.45, {
            top: "iso-holo-fill",
            left: "iso-holo-fill",
            right: "iso-holo-fill",
            highlight: false,
          }) +
          (i === 3
            ? this.cyl(b.x + b.w * 0.62, b.y + b.d * 0.55, b.h, 0.42, 0.7, "iso-holo-fill", "iso-holo-fill") +
              this.box(b.x + b.w * 0.62 - 0.38, b.y + b.d * 0.55 - 0.38, b.h, 0.12, 0.12, 0.6, {
                top: "iso-holo-fill", left: "iso-holo-fill", right: "iso-holo-fill", highlight: false,
              }) +
              this.box(b.x + b.w * 0.62 + 0.26, b.y + b.d * 0.55 + 0.26, b.h, 0.12, 0.12, 0.6, {
                top: "iso-holo-fill", left: "iso-holo-fill", right: "iso-holo-fill", highlight: false,
              })
            : "");

        const solid = `<g data-solid="${i}">` +
          this.box(b.x, b.y, 0, b.w, b.d, b.h, {
            highlight: true,
            details: solidWindows + solidRoof,
          }) +
          `</g>`;
        const holo = `<g data-holo="${i}">` +
          this.box(b.x, b.y, 0, b.w, b.d, b.h, {
            top: "iso-holo-fill",
            left: "iso-holo-fill",
            right: "iso-holo-fill",
            highlight: false,
            details:
              holoWindows +
              holoRoof +
              `<line data-scan="x" class="iso-holo-scan" filter="url(#${this.uid}-glow)" x1="0" y1="0" x2="0" y2="0"/>` +
              `<line data-scan="y" class="iso-holo-scan" x1="0" y1="0" x2="0" y2="0"/>`,
          }) +
          `</g>`;

        objects.push({
          key: b.x + b.y + b.w + b.d,
          markup: solid + holo,
          info: { i, x: b.x, y: b.y, w: b.w, d: b.d, h: b.h },
        });
      });

      // Street furniture stays solid so the block reads as a real place.
      [-6.4, -3.2, 3.2, 6.4].forEach((sx) => {
        const lamp =
          this.box(sx - 0.08, -2.35, 0, 0.16, 0.16, 2.7, { highlight: false }) +
          this.box(sx - 0.3, -2.5, 2.7, 0.6, 0.3, 0.16, { highlight: false });
        objects.push({ key: sx - 2, markup: lamp });
      });

      objects.sort((a, b) => a.key - b.key);
      const defs = `<defs><filter id="${this.uid}-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
      this.svg.innerHTML = defs + base + street + objects.map((o) => o.markup).join("");

      this.dyn.buildings = objects
        .filter((o) => o.info)
        .map((o) => {
          const holo = this.svg.querySelector(`[data-holo="${o.info.i}"]`);
          const solid = this.svg.querySelector(`[data-solid="${o.info.i}"]`);
          return {
            ...o.info,
            holo,
            solid,
            scanX: holo?.querySelector('[data-scan="x"]'),
            scanY: holo?.querySelector('[data-scan="y"]'),
          };
        });

      this.render = (phase) => {
        const p = mod(phase, 1);
        this.lastPhase = p;

        // Idle breathing. While the pointer is away, the block eases between
        // its holographic and solid views. The existing scene loop drives it,
        // so this costs one sine per frame and starts from wherever the
        // pointer left the blend.
        const idleTarget = this.idle ? 1 : 0;
        this.idleAmount += (idleTarget - this.idleAmount) * 0.06;
        const idleWave = 0.5 - 0.5 * Math.cos(TAU * p);
        const idle = this.idleAmount * idleWave;

        const blend = this.holoBlend;
        this.dyn.buildings.forEach((b, i) => {
          if (!b.holo || !b.solid) return;
          b.solid.style.opacity = Math.min(1, (1 - blend) + idle * this.idleDepth).toFixed(3);
          const flicker = 0.78 + 0.18 * (0.5 + 0.5 * Math.sin(TAU * (p * 2 + i * 0.13)));
          const glitchOn =
            this.glitch &&
            blend > 0.03 &&
            Math.sin(TAU * (p * 29 + i * 0.37)) > 0.985;
          const jitter = glitchOn ? Math.sin(TAU * (p * 47 + i)) * 1.8 : 0;
          const holo = blend * flicker * (1 - idle * this.idleDepth) * (glitchOn ? 0.82 : 1);
          b.holo.style.opacity = Math.max(0, holo).toFixed(3);
          b.holo.setAttribute("transform", `translate(${jitter.toFixed(1)} 0)`);
          const t = 0.5 + 0.5 * Math.sin(TAU * (p + i * 0.13));
          const z = b.h * t + (glitchOn ? b.h * 0.05 : 0);
          const [x1, y1] = this.P(b.x + b.w, b.y, z);
          const [x2, y2] = this.P(b.x + b.w, b.y + b.d, z);
          const [x3, y3] = this.P(b.x, b.y + b.d, z);
          b.scanX.setAttribute("x1", x1.toFixed(2));
          b.scanX.setAttribute("y1", y1.toFixed(2));
          b.scanX.setAttribute("x2", x2.toFixed(2));
          b.scanX.setAttribute("y2", y2.toFixed(2));
          b.scanY.setAttribute("x1", x2.toFixed(2));
          b.scanY.setAttribute("y1", y2.toFixed(2));
          b.scanY.setAttribute("x2", x3.toFixed(2));
          b.scanY.setAttribute("y2", y3.toFixed(2));
        });
      };
    }

    build() {
      if (this.type === "streaming") this.buildStreaming();
      else if (this.type === "logistics") this.buildLogistics();
      else if (this.type === "course") this.buildCourse();
      else if (this.type === "ar-city") this.buildArCity();
    }

    applyReduced() {
      const href = this.reduced ? this.cfg.still : this.cfg.gif;
      this.svg.querySelectorAll("image[data-gif]").forEach((img) => {
        img.setAttribute("href", href);
      });
    }

    wireControls() {
      const wrap = this.root.closest(".iso-figure");
      const holo = wrap?.querySelector("[data-iso-holo]");
      const glitch = wrap?.querySelector("[data-iso-glitch]");

      if (holo) {
        holo.value = String(this.holoBlend);
        holo.addEventListener("input", () => this.setHoloBlend(Number(holo.value)));
      }
      if (glitch) {
        glitch.checked = this.glitch;
        glitch.addEventListener("change", () => this.setGlitch(glitch.checked));
      }

      // The drawing itself is the slider: pointer x sets the blend. Leaving
      // it alone resumes the idle fade after a short pause.
      if (this.type === "ar-city" || holo) {
        const applyPointer = (clientX) => {
          const rect = this.root.getBoundingClientRect();
          const value = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
          if (holo) holo.value = String(value);
          this.setHoloBlend(value);
        };
        const stopIdle = () => this.setIdle(false);
        this.root.style.cursor = "ew-resize";
        this.root.addEventListener("pointerenter", (event) => {
          stopIdle();
          applyPointer(event.clientX);
        });
        this.root.addEventListener("pointermove", (event) => {
          stopIdle();
          applyPointer(event.clientX);
        });
        this.root.addEventListener("pointerdown", (event) => {
          stopIdle();
          applyPointer(event.clientX);
          this.root.setPointerCapture?.(event.pointerId);
        });
        if (this.type === "ar-city") {
          this.root.addEventListener("pointerleave", () => this.setIdle(true, this.idleDelay));
          this.root.addEventListener("pointercancel", () => this.setIdle(true, this.idleDelay));
        }
      }
    }

    setIdle(value, delay = 0) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
      const apply = () => {
        this.idle = Boolean(value) && this.idleAllowed && !this.reduced;
        this.root.classList.toggle("is-idle", this.idle);
      };
      if (value && delay) this.idleTimer = setTimeout(apply, delay);
      else apply();
    }

    setHoloBlend(value) {
      this.holoBlend = Math.max(0, Math.min(1, value));
      this.render(this.lastPhase || 0);
    }

    setGlitch(value) {
      this.glitch = Boolean(value);
      this.render(this.lastPhase || 0);
    }

    fitView(pad = 36) {
      const bb = this.svg.getBBox();
      if (!bb.width || !bb.height) return;
      this.svg.setAttribute(
        "viewBox",
        `${(bb.x - pad).toFixed(1)} ${(bb.y - pad).toFixed(1)} ${(bb.width + pad * 2).toFixed(1)} ${(bb.height + pad * 2).toFixed(1)}`
      );
    }

    setReduced(value) {
      this.reduced = value;
      if (value) {
        this.setIdle(false);
        this.idleAmount = 0;
      } else if (this.idleAllowed && !this.root.matches(":hover")) {
        this.setIdle(true);
        this.idleAmount = 1;
      }
      this.applyReduced();
      this.render(value ? this.hold : 0);
    }
  }

  function safeJSON(value) {
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceQuery.matches;
  let raf = null;
  const scenes = [];

  function frame(now) {
    raf = null;
    let visible = false;
    scenes.forEach((scene) => {
      if (!scene.visible || !scene.root.isConnected) return;
      visible = true;
      if (!scene.started) {
        scene.started = true;
        scene.t0 = now;
      }
      const p = mod((now - scene.t0) / 1000 / scene.duration, 1);
      scene.render(p);
    });
    if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (reduced || document.hidden || raf) return;
    if (scenes.some((scene) => scene.visible)) raf = requestAnimationFrame(frame);
  }

  function setReduced(value) {
    reduced = value;
    scenes.forEach((scene) => scene.setReduced(value));
    if (reduced && raf) {
      cancelAnimationFrame(raf);
      raf = null;
    } else {
      schedule();
    }
  }

  document.querySelectorAll("[data-iso-scene]").forEach((root) => {
    const scene = new IsoScene(root);
    scenes.push(scene);
    scene.render(reduced ? scene.hold : 0);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const scene = entry.target.__iso;
        if (!scene) return;
        scene.visible = entry.isIntersecting;
      });
      schedule();
    },
    { rootMargin: "180px 0px" }
  );
  scenes.forEach((scene) => observer.observe(scene.root));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    } else {
      schedule();
    }
  });

  reduceQuery.addEventListener("change", (event) => setReduced(event.matches));
  window.__isoScenes = scenes;
})();
