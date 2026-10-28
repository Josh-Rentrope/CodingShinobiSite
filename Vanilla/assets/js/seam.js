/* Scroll-driven ink seam (multi-instance).
   Each outgoing layer is masked by a turbulence-displaced circle. Progress
   is computed per seam from its own scroll position. */

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const seams = Array.from(document.querySelectorAll("[data-seam]"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (seams.length) {
  const instances = seams.map((seam) => {
    const sticky = seam.querySelector(".seam-sticky");
    const outgoing = seam.querySelector("[data-seam-out]");
    const mask = seam.querySelector("mask");
    const maskBg = mask ? mask.querySelector("rect") : null;
    const circle = mask ? mask.querySelector("circle") : null;
    const fromDim = seam.dataset.from || "soil";
    const toDim = seam.dataset.to || "physics";

    return { seam, sticky, outgoing, mask, maskBg, circle, fromDim, toDim };
  });

  let queued = false;

  function applyAll() {
    instances.forEach(({ seam, sticky, outgoing, mask, maskBg, circle, fromDim, toDim }) => {
      if (!sticky || !outgoing) return;

      const rect = seam.getBoundingClientRect();
      const top = rect.top;
      const w = sticky.clientWidth;
      const h = sticky.clientHeight;

      const progress = clamp01(-top / Math.max(h * 0.5, 1));
      const done = progress >= 0.995;

      seam.dataset.seamProgress = progress.toFixed(3);
      seam.dataset.dimension = progress < 0.5 ? fromDim : toDim;

      if (reducedMotion || !mask || !circle) {
        outgoing.style.opacity = String(1 - progress);
      } else {
        outgoing.style.opacity = "1";

        const originX = w * 0.5;
        const originY = h * 0.72;
        const farthest = Math.max(
          Math.hypot(originX, originY),
          Math.hypot(w - originX, originY),
          Math.hypot(originX, h - originY),
          Math.hypot(w - originX, h - originY)
        );

        mask.setAttribute("width", w);
        mask.setAttribute("height", h);
        if (maskBg) {
          maskBg.setAttribute("width", w);
          maskBg.setAttribute("height", h);
        }
        circle.setAttribute("cx", originX);
        circle.setAttribute("cy", originY);
        circle.setAttribute("r", progress * (farthest * 1.05 + 80));
      }

      if (done) {
        outgoing.style.visibility = "hidden";
        outgoing.style.pointerEvents = "none";
        outgoing.inert = true;
      } else {
        outgoing.style.visibility = "visible";
        outgoing.style.pointerEvents = "auto";
        outgoing.inert = false;
      }
    });
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyAll();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", applyAll);
  window.addEventListener("load", applyAll);
  applyAll();
}