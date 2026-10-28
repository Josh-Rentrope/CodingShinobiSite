/* Early Days horizontal carousel.
   The cards, not the panel count, decide the travel. The track moves from
   the first card's left edge to the last card's right edge, and the section
   is exactly as tall as that journey plus the sticky frame. Native page
   scroll supplies the distance; the sticky frame stays put and the track
   translates. No scroll hijack, no library. */

(() => {
  const section = document.querySelector("[data-carousel]");
  if (!section) return;

  const sticky = section.querySelector(".early-sticky");
  const track = section.querySelector("[data-carousel-track]");
  if (!sticky || !track) return;

  const panels = [...track.children];
  const flat = matchMedia("(max-width: 860px), (prefers-reduced-motion: reduce)");
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  let queued = false;
  let measured = false;
  let distance = 0;

  function measure() {
    if (flat.matches) {
      distance = 0;
      measured = false;
      section.style.removeProperty("--carousel-distance");
      track.style.transform = "";
      return;
    }

    // scrollWidth is the card row's real extent; clientWidth is the sticky
    // frame. The difference is exactly the distance from card 1's left edge
    // to the last card's right edge.
    distance = Math.max(0, track.scrollWidth - sticky.clientWidth);
    measured = true;
    section.style.setProperty("--carousel-distance", `${distance}px`);
  }

  function update() {
    queued = false;
    if (flat.matches) {
      track.style.transform = "";
      return;
    }
    if (!measured) measure();
    if (!distance) {
      track.style.transform = "";
      return;
    }

    const header = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--header-h")
    ) || 60;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const start = top - header;
    const progress = clamp((window.scrollY - start) / distance, 0, 1);
    track.style.transform = `translate3d(${(-progress * distance).toFixed(2)}px, 0, 0)`;
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function refresh() {
    measure();
    update();
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", refresh);
  flat.addEventListener("change", refresh);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(refresh);
    observer.observe(sticky);
    panels.forEach((panel) => observer.observe(panel));
  }
  if (document.fonts?.ready) document.fonts.ready.then(refresh);

  refresh();
})();
