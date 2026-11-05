/* Selected work: a scroll-linked 3D card carousel and a case dialog.
   The transforms are computed from each card's distance to the viewport
   centre. Nothing runs when the page is still. */

const CASES = {
  "imaging-app": {
    kicker: "Augmenting Orgs / Clinical imaging",
    title: "Orthodontic 3D imaging",
    year: "2026",
    accent: "#b91c1c",
    body: [
      "Surgeons and orthodontists shouldn't be left waiting on massive 3D volume downloads—or worse, trusting an on-screen ruler that hasn't been calibrated. I redesigned the clinical viewer around one non-negotiable rule: never show a measurement the physical scale can't back up.",
      "Instead of pulling entire anatomical volumes over the wire, the viewer streams only the exact slice a clinician is examining in real time, locking out caliper tools until voxel calibration is mathematically verified end-to-end.",
    ],
    receipts: [
      ["Zero", "uncalibrated measurements", "enforced"],
      ["168", "clinical invariant tests", "verified"],
      ["Real-time", "slice-by-slice streaming", "built"],
    ],
    stack: "FastAPI · vtk.js · S3 · Terraform",
    demo: "https://web.imaging-app.do.codingshinobi.org",
    media: [
      { img: "assets/img/bone-viewer.webp", alt: "Bone Viewer 3D workspace with a segmented volume, structure list, and pipeline controls" },
      { board: "receipts" },
    ],
  },
  trials: {
    kicker: "AI Done Right / Clinical data",
    title: "Clinical trials discovery",
    year: "2025—2026",
    accent: "#dc2626",
    body: [
      "Connecting patients and clinicians to 607,160 global studies and 3.5 million medical facilities shouldn't require a degree in database query syntax—and it definitely can't tolerate an AI that makes things up.",
      "I built an interactive geospatial discovery platform paired with a strictly grounded AI agent. Because the model can only interact through parameterized SQL, every single trial it surfaces is guaranteed to be a real, verifiable clinical record.",
    ],
    receipts: [
      ["607,160", "clinical studies mapped", "indexed"],
      ["3.5M", "medical facilities", "indexed"],
      ["Zero", "hallucinated studies", "guaranteed"],
    ],
    stack: "Next.js · FastAPI · PostgreSQL / PostGIS · Clerk",
    demo: "https://trials.do.codingshinobi.org/",
    media: [
      { img: "assets/img/trials.webp", alt: "Map-based clinical trials search interface" },
      { board: "receipts" },
    ],
  },
  interactive: {
    kicker: "Teams and Platforms / Interactive",
    title: "Interactive Unity/Unreal Experiences",
    year: "2023—2026",
    accent: "#0e7490",
    body: [
      "Great simulation software needs to feel as intuitive and responsive as a great game. I built a playable collectible card game in Unity as a proving ground for clean, deterministic state machines and tactile UI.",
      "I brought those exact interaction patterns to our enterprise simulation clients—coaching engineering teams as we wired XR interactions, multi-user state reconciliation, and live physics into massive Unreal Engine worlds.",
    ],
    receipts: [
      ["Playable CCG", "deterministic rules engine", "built"],
      ["10,000+", "networked Unreal entities", "synchronized"],
      ["XR & Sim", "client team enablement", "mentored"],
    ],
    stack: "Unity · C# · Unreal Engine · C++",
    media: [
      { img: "assets/img/unity-ccg.webp", alt: "Collectible card game prototype built in Unity" },
      { board: "receipts" },
    ],
  },
  hpc: {
    kicker: "Teams and Platforms / Throughput",
    title: "High-velocity physics & digital twins",
    year: "2023—2024",
    accent: "#0e7490",
    body: [
      "Twelve scientific analysts were burning hours hand-wrangling massive 900 GB simulation files, where a single manual setup error meant starting over. I sat alongside their team and built a 64-process InfiniBand pipeline processing 1 TB/min that eliminated setup errors completely.",
      "For that same client, we brought the data to life inside a shared Unreal Engine digital twin—synchronizing over 10,000 live objects with orbital mechanics, inverse kinematics, and finite element analysis.",
    ],
    receipts: [
      ["1 TB/min", "across 64 HPC processes", "measured"],
      ["10,000+", "live simulated entities", "synchronized"],
      ["12 analysts", "freed from manual wrangling", "impact"],
    ],
    stack: "Python · C++ · Unreal Engine · Qt · Spark · HDF5",
    media: [
      { img: "assets/img/twin.webp", alt: "Networked simulation environment" },
      { board: "receipts" },
    ],
  },
  govcloud: {
    kicker: "AI Done Right / Platform",
    title: "Forty services, one medallion",
    year: "2025",
    accent: "#161514",
    body: [
      "A fragmented federal estate of forty microservices and over a hundred relational tables was stalling out under strict DISA STIG compliance and manual notebook deployments.",
      "Working across security and engineering teams, I unified the entire data architecture into a single governed Medallion platform with automated Terraform and GitOps pipelines—turning a fragile release process into a reliable, high-velocity engine that shipped four times as many features per week.",
    ],
    receipts: [
      ["40+ services", "unified under one architecture", "governed"],
      ["100+ tables", "mapped & consolidated", "architected"],
      ["4× velocity", "weekly feature delivery", "impact"],
    ],
    stack: "Databricks · Unity Catalog · Terraform · AWS / Azure GovCloud",
    media: [
      { board: "medallion" },
      { board: "receipts" },
    ],
  },
};

/* Recap pages live in a subfolder and declare <html data-asset-root="../">,
   so media paths keep resolving. The live pages declare nothing and the
   prefix stays empty. */
const FLAGSHIP_ASSET_ROOT = document.documentElement.dataset.assetRoot || "";
if (FLAGSHIP_ASSET_ROOT) {
  for (const entry of Object.values(CASES)) {
    for (const item of entry.media || []) {
      if (item.img) item.img = FLAGSHIP_ASSET_ROOT + item.img;
    }
  }
}

/* ------------------------------------------------------------------
   3D carousel
   ------------------------------------------------------------------ */

const cards = Array.from(document.querySelectorAll(".flag-card"));
const list = document.querySelector("[data-flag-list]");
const flat = window.matchMedia("(max-width: 900px), (prefers-reduced-motion: reduce)");
let carouselQueued = false;

function updateCarousel() {
  if (flat.matches) {
    cards.forEach((card) => {
      card.style.removeProperty("--x");
      card.style.removeProperty("--ry");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--tz");
      card.style.removeProperty("--sc");
      card.style.removeProperty("--op");
      card.style.zIndex = "";
    });
    return;
  }

  const vh = window.innerHeight;
  const listTop = list.getBoundingClientRect().top + window.scrollY;

  cards.forEach((card) => {
    // Measure the layout position, not the transformed one. Reading the
    // transformed rect would feed the rotation back into its own input.
    const centre = listTop + card.offsetTop + card.offsetHeight / 2;
    const offset = (centre - (window.scrollY + vh / 2)) / vh;
    const distance = Math.min(Math.abs(offset), 1.25);

    // Vertical tilt and depth, plus a full right-to-left traverse and a Y
    // turn as the card passes the centre. Everything is zero at the centre.
    const drift = Math.max(
      -window.innerWidth * 0.3,
      Math.min(window.innerWidth * 0.3, offset * window.innerWidth * 0.22)
    );

    card.style.setProperty("--rx", `${(-offset * 22).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(offset * 18).toFixed(2)}deg`);
    card.style.setProperty("--x", `${drift.toFixed(1)}px`);
    card.style.setProperty("--tz", `${(-distance * 150).toFixed(1)}px`);
    card.style.setProperty("--sc", (1 - distance * 0.07).toFixed(3));
    card.style.setProperty("--op", (1 - distance * 0.45).toFixed(3));
    card.style.zIndex = String(100 - Math.round(distance * 50));
  });
}

function scheduleCarousel() {
  if (carouselQueued) return;
  carouselQueued = true;
  requestAnimationFrame(() => {
    carouselQueued = false;
    updateCarousel();
  });
}

window.addEventListener("scroll", scheduleCarousel, { passive: true });
window.addEventListener("resize", scheduleCarousel);
flat.addEventListener("change", updateCarousel);
updateCarousel();

/* ------------------------------------------------------------------
   Case dialog
   ------------------------------------------------------------------ */

const dialog = document.getElementById("case-dialog");
const stage = dialog.querySelector("[data-media-stage]");
const countOut = dialog.querySelector("[data-media-count]");
const dots = dialog.querySelector("[data-media-dots]");

let current = null;
let mediaIndex = 0;
let lastCard = null;

function renderMedia() {
  if (!current) return;
  const item = current.media[mediaIndex];
  stage.replaceChildren();

  if (item.img) {
    const img = document.createElement("img");
    img.src = item.img;
    img.alt = item.alt;
    stage.append(img);
  } else if (item.board === "receipts") {
    const board = document.createElement("div");
    board.className = "media-board";
    current.receipts.forEach(([value, label, state]) => {
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = value;
      const span = document.createElement("span");
      span.textContent = label;
      const tag = document.createElement("em");
      tag.textContent = state;
      span.append(tag);
      row.append(strong, span);
      board.append(row);
    });
    stage.append(board);
  } else if (item.board === "medallion") {
    const board = document.createElement("div");
    board.className = "media-medallion";
    ["Gold", "Silver", "Bronze"].forEach((name) => {
      const span = document.createElement("span");
      span.textContent = name;
      board.append(span);
    });
    stage.append(board);
  }

  countOut.textContent = `${mediaIndex + 1} / ${current.media.length}`;
  dots.replaceChildren();
  current.media.forEach((_, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Slide ${i + 1}`);
    if (i === mediaIndex) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => {
      mediaIndex = i;
      renderMedia();
    });
    dots.append(button);
  });
}

function stepMedia(delta) {
  if (!current) return;
  mediaIndex = (mediaIndex + delta + current.media.length) % current.media.length;
  renderMedia();
}

/* ------------------------------------------------------------------
   FLIP open / close

   A card is a rotated box inside a perspective container, so its four
   corners land in a trapezoid on screen. The modal is a different aspect
   ratio, so a single scale factor can never put the corners on top of
   each other. We measure where the card's corners actually are, then
   solve the four-point homography that carries the modal's corners onto
   them. That matrix is the first keyframe of the flight.
   ------------------------------------------------------------------ */

const IDENTITY_3D = "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)";

function matrixOf(value) {
  if (!value || value === "none") return new DOMMatrix();
  try {
    return new DOMMatrix(value);
  } catch (error) {
    return new DOMMatrix();
  }
}

/* Computed transform-origin and perspective-origin arrive as px, but a
   percentage fallback costs nothing and keeps this honest in browsers
   that keep the percentage. */
function lengthPair(value, width, height) {
  const parts = String(value || "").trim().split(/\s+/);
  const pick = (part, base) => {
    const number = parseFloat(part);
    if (!Number.isFinite(number)) return base / 2;
    return /%$/.test(part) ? (base * number) / 100 : number;
  };
  return [pick(parts[0], width), pick(parts[1] || "50%", height)];
}

function cornersOfQuad(quad) {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

function cornersOfRect(rect) {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
}

/* The nearest ancestor carrying a real perspective(). */
function perspectiveOf(element) {
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    const depth = parseFloat(style.perspective);
    if (style.perspective === "none" || !(depth > 0)) continue;
    const rect = node.getBoundingClientRect();
    const [originX, originY] = lengthPair(style.perspectiveOrigin, rect.width, rect.height);
    return {
      node,
      depth,
      originX: rect.left + originX,
      originY: rect.top + originY,
    };
  }
  return null;
}

/* Where the card's corners really are, perspective included. Falls back
   to the plain bounding box whenever the projection can't be trusted. */
function projectedCorners(card) {
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const parent = card.offsetParent;
  if (!width || !height || !parent) return null;

  const parentStyle = getComputedStyle(parent);
  const parentRect = parent.getBoundingClientRect();
  const layoutLeft =
    parentRect.left + (parseFloat(parentStyle.borderLeftWidth) || 0) + card.offsetLeft;
  const layoutTop =
    parentRect.top + (parseFloat(parentStyle.borderTopWidth) || 0) + card.offsetTop;

  const style = getComputedStyle(card);
  const matrix = matrixOf(style.transform);
  const [originX, originY] = lengthPair(style.transformOrigin, width, height);
  const originPageX = layoutLeft + originX;
  const originPageY = layoutTop + originY;

  // A perspective further up the tree would mean extra transform layers
  // between the card and the projection, so we don't guess past it.
  const lens = perspectiveOf(card.parentElement);
  const project = Boolean(lens) && lens.node === parent;

  const local = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];

  const points = [];
  for (const [x, y] of local) {
    const dx = x - originX;
    const dy = y - originY;
    const offsetX = matrix.m11 * dx + matrix.m21 * dy + matrix.m41;
    const offsetY = matrix.m12 * dx + matrix.m22 * dy + matrix.m42;
    const offsetZ = matrix.m13 * dx + matrix.m23 * dy + matrix.m43;
    const pageX = originPageX + offsetX;
    const pageY = originPageY + offsetY;

    if (!project) {
      points.push({ x: pageX, y: pageY });
      continue;
    }
    const denominator = lens.depth - offsetZ;
    if (!(denominator > 1)) return null;
    const k = lens.depth / denominator;
    points.push({
      x: lens.originX + (pageX - lens.originX) * k,
      y: lens.originY + (pageY - lens.originY) * k,
    });
  }
  return points;
}

function cardCorners(card) {
  const quad = projectedCorners(card);
  if (quad && quad.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) {
    return quad;
  }
  return cornersOfRect(card.getBoundingClientRect());
}

/* The scale the modal needs to sit inside the card box. Width and height
   are separate numbers on purpose: one shared factor is what let the
   corners drift apart in the first place. */
function flightScale(fromRect, toRect) {
  return {
    x: toRect.width ? fromRect.width / toRect.width : 1,
    y: toRect.height ? fromRect.height / toRect.height : 1,
  };
}

/* Four point pairs, eight unknowns (a b c d e f g h), Gaussian
   elimination with partial pivoting. Returns null when degenerate. */
function solveHomography(source, target) {
  const rows = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = source[i];
    const { x: u, y: v } = target[i];
    rows.push([x, 0, y, 0, 1, 0, -x * u, -y * u, u]);
    rows.push([0, x, 0, y, 0, 1, -x * v, -y * v, v]);
  }

  for (let column = 0; column < 8; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-9) return null;
    if (pivot !== column) {
      const swap = rows[column];
      rows[column] = rows[pivot];
      rows[pivot] = swap;
    }
    const lead = rows[column][column];
    for (let j = column; j <= 8; j += 1) rows[column][j] /= lead;
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      if (!factor) continue;
      for (let j = column; j <= 8; j += 1) rows[row][j] -= factor * rows[column][j];
    }
  }
  return rows.map((row) => row[8]);
}

function round(value) {
  return Math.abs(value) < 1e-6 ? 0 : Number(value.toFixed(6));
}

/* Fallback for the rare unsolvable case: centre-to-centre with the two
   axis scales. Same idea, no rotation in the projection. */
function fallbackFlight(quad, dialogRect) {
  const box = cornersOfQuad(quad);
  const scale = flightScale(box, dialogRect);
  const dx = box.left + box.width / 2 - (dialogRect.left + dialogRect.width / 2);
  const dy = box.top + box.height / 2 - (dialogRect.top + dialogRect.height / 2);
  return `translate3d(${round(dx)}px, ${round(dy)}px, 0) scale(${round(scale.x)}, ${round(scale.y)})`;
}

/* The start-of-flight transform: the modal's corners onto the card's. */
function flightTransform(dialogRect) {
  const quad = cardCorners(lastCard);
  const centreX = dialogRect.left + dialogRect.width / 2;
  const centreY = dialogRect.top + dialogRect.height / 2;
  const source = cornersOfRect(dialogRect).map((point) => ({
    x: point.x - centreX,
    y: point.y - centreY,
  }));
  const target = quad.map((point) => ({ x: point.x - centreX, y: point.y - centreY }));

  const solved = solveHomography(source, target);
  if (!solved) return fallbackFlight(quad, dialogRect);

  const [a, b, c, d, e, f, g, h] = solved;
  const values = [a, b, 0, g, c, d, 0, h, 0, 0, 1, 0, e, f, 0, 1].map(round);
  return `matrix3d(${values.join(", ")})`;
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let cardState = null;
let sourceOpacity = "1";
let openAnim = null;
let openFade = null;
let closeAnim = null;
let closeFade = null;
let cardAnim = null;
let isClosing = false;
let pendingClose = false;

function readCard(card) {
  return { opacity: getComputedStyle(card).opacity };
}

function resetDialogMotion() {
  dialog.style.transform = "";
  dialog.style.opacity = "";
  dialog.style.transformOrigin = "";
  dialog.style.willChange = "";
}

function animateOpen() {
  if (reduceMotion.matches) return;

  // Measured here, after the dialog is open and the scroll lock has
  // reflowed the page, so the flight starts where the card is *now*.
  const dialogRect = dialog.getBoundingClientRect();
  const start = flightTransform(dialogRect);
  dialog.style.willChange = "transform, opacity";

  // One flight, two curves. The corners ride the transform; the strength
  // rides the opacity. At full strength the opening frames read as the
  // modal's content squeezed into the card's box, so the modal comes up
  // while the card goes down and only reaches full strength once the
  // corners have settled on their layout position.
  openFade = dialog.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    {
      duration: 400,
      delay: 80,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
      fill: "both",
    }
  );

  // The card holds for a beat, then hands over to the arriving modal.
  cardAnim = lastCard.animate(
    [{ opacity: cardState.opacity }, { opacity: 0 }],
    { duration: 220, delay: 90, easing: "cubic-bezier(0.33, 1, 0.68, 1)", fill: "forwards" }
  );

  // Transform only: an opacity keyframe here would sit on the same
  // property as the fade above and win on composite order.
  openAnim = dialog.animate(
    [{ transform: start }, { transform: IDENTITY_3D }],
    { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  );

  openAnim.finished
    .then(() => {
      const finished = openAnim;
      openAnim = null;
      if (finished) finished.cancel();
      if (openFade) {
        openFade.cancel();
        openFade = null;
      }
      resetDialogMotion();
      if (pendingClose) {
        pendingClose = false;
        closeCase();
      }
    })
    .catch(() => {});
}

function openCase(id, card) {
  const data = CASES[id];
  if (!data) return;

  if (openAnim) {
    openAnim.cancel();
    openAnim = null;
  }
  if (openFade) {
    openFade.cancel();
    openFade = null;
  }
  if (closeAnim) {
    closeAnim.cancel();
    closeAnim = null;
  }
  if (closeFade) {
    closeFade.cancel();
    closeFade = null;
  }
  if (cardAnim) {
    cardAnim.cancel();
    cardAnim = null;
  }
  if (lastCard) lastCard.style.opacity = "";

  isClosing = false;
  pendingClose = false;
  resetDialogMotion();
  dialog.classList.remove("is-open");

  current = data;
  mediaIndex = 0;
  lastCard = card;
  cardState = readCard(card);
  sourceOpacity = cardState.opacity;

  dialog.style.setProperty("--case-accent", data.accent);
  dialog.querySelector("[data-case-kicker]").textContent = data.kicker;
  dialog.querySelector("[data-case-title]").textContent = data.title;
  dialog.querySelector("[data-case-name]").textContent = data.title;
  dialog.querySelector("[data-case-year]").textContent = data.year;

  const body = dialog.querySelector("[data-case-body]");
  body.replaceChildren();
  data.body.forEach((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    body.append(p);
  });

  const receipts = dialog.querySelector("[data-case-receipts]");
  receipts.replaceChildren();
  data.receipts.forEach(([value, label, state]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    const tag = document.createElement("span");
    tag.textContent = state;
    dd.append(tag);
    row.append(dt, dd);
    receipts.append(row);
  });

  dialog.querySelector("[data-case-stack]").textContent = data.stack;

  const demo = dialog.querySelector("[data-case-link]");
  if (data.demo) {
    demo.href = data.demo;
    demo.textContent = "Open live demo →";
    demo.hidden = false;
  } else {
    demo.removeAttribute("href");
    demo.textContent = "";
    demo.hidden = true;
  }

  renderMedia();
  if (!dialog.open) dialog.showModal();
  document.documentElement.classList.add("dialog-open");
  requestAnimationFrame(() => dialog.classList.add("is-open"));
  dialog.querySelector("[data-dialog-close]").focus({ preventScroll: true });
  animateOpen();
}

function closeCase() {
  if (!dialog.open || isClosing) return;

  if (reduceMotion.matches || !lastCard || !cardState) {
    dialog.close();
    return;
  }

  if (openAnim) {
    pendingClose = true;
    return;
  }

  isClosing = true;
  dialog.classList.remove("is-open");

  const dialogRect = dialog.getBoundingClientRect();
  const target = flightTransform(dialogRect);
  const previousCardAnim = cardAnim;
  const previousCloseFade = closeFade;

  // Out the same way: the geometry heads back to the card while the modal
  // loses its strength, so the swapped aspect ratio never reads as a jump.
  closeFade = dialog.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 260, delay: 60, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
  );
  if (previousCloseFade) previousCloseFade.cancel();

  // The card comes back late, while the modal is still covering it. The
  // backwards fill keeps it invisible through the delay instead of letting
  // its layout opacity show for a fifth of a second.
  cardAnim = lastCard.animate(
    [{ opacity: 0 }, { opacity: sourceOpacity }],
    {
      duration: 260,
      delay: 160,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "both",
    }
  );
  if (previousCardAnim) previousCardAnim.cancel();

  closeAnim = dialog.animate(
    [{ transform: IDENTITY_3D }, { transform: target }],
    { duration: 420, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
  );

  closeAnim.finished
    .then(() => {
      // Leaving the fade filled in would keep opacity at zero for the next
      // open, so it goes before the dialog leaves the top layer.
      if (closeFade) {
        closeFade.cancel();
        closeFade = null;
      }
      dialog.close();
    })
    .catch(() => dialog.close());
}

cards.forEach((card) => {
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-controls", "case-dialog");

  card.addEventListener("click", () => openCase(card.dataset.case, card));

  card.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
      event.preventDefault();
      openCase(card.dataset.case, card);
    }
  });
});

dialog.querySelector("[data-dialog-close]").addEventListener("click", closeCase);
dialog.querySelector("[data-media-prev]").addEventListener("click", () => stepMedia(-1));
dialog.querySelector("[data-media-next]").addEventListener("click", () => stepMedia(1));

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeCase();
});

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCase();
});

dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepMedia(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    stepMedia(1);
  }
});

dialog.addEventListener("close", () => {
  document.documentElement.classList.remove("dialog-open");
  dialog.classList.remove("is-open");
  resetDialogMotion();
  if (openAnim) {
    openAnim.cancel();
    openAnim = null;
  }
  if (openFade) {
    openFade.cancel();
    openFade = null;
  }
  if (closeAnim) {
    closeAnim.cancel();
    closeAnim = null;
  }
  if (closeFade) {
    closeFade.cancel();
    closeFade = null;
  }
  if (cardAnim) {
    cardAnim.cancel();
    cardAnim = null;
  }
  if (lastCard) {
    lastCard.style.opacity = "";
    lastCard.focus({ preventScroll: true });
  }
  isClosing = false;
  pendingClose = false;
});