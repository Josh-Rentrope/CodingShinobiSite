/* Scroll is the single source of truth.
   It drives the dimension theme, the index head, the header, and reveals.
   No library, no smooth-scroll hijack. */

const root = document.documentElement;
const acts = Array.from(document.querySelectorAll(".act"));
const links = Array.from(document.querySelectorAll(".scrubber-list a"));

/* Adding an act is a content change, not a CSS change. */
document.documentElement.style.setProperty("--act-count", String(acts.length));
const fill = document.querySelector(".scrubber-fill");
const head = document.querySelector(".scrubber-head");
const scrubber = document.querySelector(".scrubber");

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

let queued = false;
let activeIndex = -1;

function measure() {
  return acts.map((act) => {
    const rect = act.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
}

function syncDimension() {
  const el = document.elementFromPoint(window.innerWidth * 0.5, window.innerHeight * 0.45);
  const section = el && el.closest("[data-dimension]");
  if (section) root.dataset.dimension = section.dataset.dimension;
}

function update() {
  const mid = window.scrollY + window.innerHeight * 0.5;
  const sizes = measure();

  let index = sizes.length - 1;
  let progress = 1;

  for (let i = 0; i < sizes.length; i += 1) {
    const { top, height } = sizes[i];
    if (mid < top + height || i === sizes.length - 1) {
      index = i;
      progress = clamp((mid - top) / height, 0, 1);
      break;
    }
  }

  // A seam owns its own dimension. Make the index follow it rather than the
  // act section that contains it, so the label matches what is on screen.
  const seamPoint = document.elementFromPoint(
    window.innerWidth * 0.5,
    window.innerHeight * 0.45
  );
  const seam = seamPoint && seamPoint.closest("[data-seam]");
  if (seam) {
    const dimension = seam.dataset.dimension;
    const seamIndex = acts.findIndex((act) => act.dataset.dimension === dimension);
    if (seamIndex >= 0) {
      index = seamIndex;
      progress = dimension === "soil" ? 1 : 0;
    }
  }

  if (index !== activeIndex) {
    activeIndex = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  const fraction = (index + progress) / Math.max(sizes.length, 1);
  if (fill) fill.style.width = `${fraction * 100}%`;
  if (head) head.style.left = `${fraction * 100}%`;

  syncDimension();

  queued = false;
}

function requestUpdate() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(update);
  }
}

window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", requestUpdate);
window.addEventListener("load", requestUpdate);
update();

/* Drag anywhere on the bar to scrub. Links keep their native behaviour. */
if (scrubber) {
  let dragging = false;

  const scrubTo = (clientX) => {
    const rect = scrubber.getBoundingClientRect();
    const style = getComputedStyle(scrubber);
    const pad = parseFloat(style.paddingLeft) || 0;
    const usable = rect.width - pad * 2;
    const x = clamp((clientX - rect.left - pad) / usable, 0, 0.9999);
    const scaled = x * acts.length;
    const index = Math.floor(scaled);
    const act = acts[index];
    if (!act) return;

    const top = act.getBoundingClientRect().top + window.scrollY;
    const target = top + (scaled - index) * act.offsetHeight - window.innerHeight * 0.5;
    window.scrollTo({ top: target, behavior: "instant" });
  };

  scrubber.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a")) return;
    dragging = true;
    scrubber.setPointerCapture(event.pointerId);
    scrubTo(event.clientX);
  });

  scrubber.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    event.preventDefault();
    scrubTo(event.clientX);
  });

  const stop = () => { dragging = false; };
  scrubber.addEventListener("pointerup", stop);
  scrubber.addEventListener("pointercancel", stop);
}

/* Reveal once, then stop observing. */
const reveals = Array.from(document.querySelectorAll(".reveal"));
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
  );
  reveals.forEach((el) => observer.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}


//For the Parallaxed element in the Hero section
(() => {
  const container = document.querySelector('[data-hero-parallax]');
  if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layers = [...container.querySelectorAll('[data-depth]')];
  let targetX = 0, targetY = 0, currentX = 0, currentY = 0, scrollY = window.scrollY;

  window.addEventListener('pointermove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 60;
    targetY = (e.clientY / window.innerHeight - 0.5) * 60;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  function tick() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    for (const layer of layers) {
      const depth = parseFloat(layer.dataset.depth) || 0.2;
      const moveX = currentX * depth;
      const moveY = (currentY * depth) - (scrollY * depth * 0.35);
      layer.style.transform = `translate3d(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px, 0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();