/* Two small instruments for the case study.
   Both are deterministic functions of a single value, which is the point. */

const SVG_NS = "http://www.w3.org/2000/svg";

/* ------------------------------------------------------------------
   Byte-range plane stack
   ------------------------------------------------------------------ */
const slice = document.querySelector("[data-byteslice]");

if (slice) {
  const COUNT = 125;
  const W = 210;
  const H = 112;
  const SKEW = 48;
  const OX = 88;
  const OY = 278;
  const DX = 2.2;
  const DY = -1.3;

  const group = slice.querySelector("[data-planes]");
  const highlight = slice.querySelector("[data-highlight]");
  const range = slice.querySelector("[data-byteslice-range]");
  const readout = slice.querySelector("[data-byteslice-readout]");
  const offsetOut = slice.querySelector("[data-byteslice-offset]");
  const label = slice.querySelector("[data-slice-label]");

  const pointsFor = (i) => {
    const x = OX + i * DX;
    const y = OY + i * DY;
    return `${x},${y} ${x + W},${y} ${x + W + SKEW},${y + H} ${x + SKEW},${y + H}`;
  };

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < COUNT; i += 1) {
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", pointsFor(i));
    polygon.setAttribute("class", "plane");
    fragment.appendChild(polygon);
  }
  if (group) group.appendChild(fragment);

  const megabytes = (i) => Math.round(i * 0.25 * 100) / 100;

  const render = () => {
    const i = Number(range.value);
    if (highlight) highlight.setAttribute("points", pointsFor(i));
    if (readout) readout.textContent = `plane ${i} / ${COUNT - 1}`;
    if (offsetOut) offsetOut.textContent = `${megabytes(i)} MB`;
    if (label) label.textContent = `PLANE ${i}`;
  };

  if (range) range.addEventListener("input", render);
  render();
}

/* ------------------------------------------------------------------
   Scale invariant
   ------------------------------------------------------------------ */
const scale = document.querySelector("[data-scalecheck]");

if (scale) {
  const button = scale.querySelector("[data-scalecheck-toggle]");
  const value = scale.querySelector("[data-scalecheck-value]");
  const note = scale.querySelector("[data-scalecheck-note]");

  button.addEventListener("click", () => {
    const verified = button.getAttribute("aria-pressed") === "true";
    const next = !verified;

    button.setAttribute("aria-pressed", String(next));
    scale.classList.toggle("is-unverified", !next);
    value.textContent = next ? "42.7 mm" : "— withheld";
    note.textContent = next
      ? "scale.verified: true"
      : "scale.verified: false — measurement suppressed";
  });
}

/* ------------------------------------------------------------------
   Reading progress
   ------------------------------------------------------------------ */
const progressBar = document.querySelector(".read-progress span");

if (progressBar) {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  update();
}
