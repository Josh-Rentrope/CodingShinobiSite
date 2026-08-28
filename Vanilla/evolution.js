(() => {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const header = document.querySelector(".site-header");
    const progressBar = document.querySelector(".story-progress span");
    const navToggle = document.querySelector(".nav-toggle");
    const chapterNav = document.querySelector(".chapter-nav");
    const chapterLinks = [...document.querySelectorAll("[data-chapter-link]")];
    const scenes = [...document.querySelectorAll("[data-scene]")];

    function updatePageState() {
        const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const progress = Math.min(window.scrollY / scrollable, 1);
        header?.classList.toggle("scrolled", window.scrollY > 24);
        if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
    }

    navToggle?.addEventListener("click", () => {
        const open = chapterNav.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(open));
    });

    chapterLinks.forEach((link) => {
        link.addEventListener("click", () => {
            chapterNav.classList.remove("open");
            navToggle?.setAttribute("aria-expanded", "false");
        });
    });

    const sectionObserver = new IntersectionObserver((entries) => {
        const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.id;
        chapterLinks.forEach((link) => {
            link.classList.toggle("active", link.dataset.chapterLink === id);
        });
    }, { rootMargin: "-35% 0px -50%", threshold: [0, 0.15, 0.4] });

    scenes.forEach((scene) => sectionObserver.observe(scene));
    window.addEventListener("scroll", updatePageState, { passive: true });
    updatePageState();

    function initCanvas() {
        const canvas = document.getElementById("evolution-canvas");
        if (!canvas || reducedMotion.matches) return;

        const context = canvas.getContext("2d", { alpha: true });
        if (!context) return;

        const pointer = { x: 0.5, y: 0.5 };
        let width = 0;
        let height = 0;
        let ratio = 1;
        let frame = 0;
        let visible = !document.hidden;
        let nodes = [];

        function makeNodes() {
            const count = Math.max(18, Math.min(42, Math.round(width / 38)));
            nodes = Array.from({ length: count }, (_, index) => ({
                angle: (index / count) * Math.PI * 2,
                radius: 0.13 + ((index * 17) % 31) / 100,
                phase: (index * 1.618) % (Math.PI * 2),
                speed: 0.00008 + (index % 5) * 0.000018
            }));
        }

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            makeNodes();
        }

        function positionFor(node, time, storyProgress) {
            const spread = Math.min(width, height) * (0.25 + storyProgress * 0.22);
            const spiral = node.angle + time * node.speed + storyProgress * Math.PI * 1.7;
            const organic = Math.sin(time * 0.00025 + node.phase) * 18 * storyProgress;
            return {
                x: width * (0.5 + (pointer.x - 0.5) * 0.035) + Math.cos(spiral) * spread * node.radius * 2 + organic,
                y: height * (0.5 + (pointer.y - 0.5) * 0.025) + Math.sin(spiral * (1.05 + storyProgress * 0.12)) * spread * node.radius * 1.6
            };
        }

        function draw(time) {
            if (!visible) return;
            context.clearRect(0, 0, width, height);
            const maxScroll = Math.max(document.documentElement.scrollHeight - height, 1);
            const storyProgress = Math.min(window.scrollY / maxScroll, 1);
            const positions = nodes.map((node) => positionFor(node, time, storyProgress));
            const connectionDistance = 75 + storyProgress * 95;

            context.lineWidth = 0.7;
            for (let a = 0; a < positions.length; a += 1) {
                for (let b = a + 1; b < positions.length; b += 1) {
                    const dx = positions[a].x - positions[b].x;
                    const dy = positions[a].y - positions[b].y;
                    const distance = Math.hypot(dx, dy);
                    if (distance < connectionDistance) {
                        const opacity = (1 - distance / connectionDistance) * (0.035 + storyProgress * 0.12);
                        context.strokeStyle = `rgba(184, 255, 101, ${opacity})`;
                        context.beginPath();
                        context.moveTo(positions[a].x, positions[a].y);
                        context.lineTo(positions[b].x, positions[b].y);
                        context.stroke();
                    }
                }
            }

            positions.forEach((position, index) => {
                const size = index % 7 === 0 ? 2.2 : 1.15;
                context.fillStyle = index % 5 === 0
                    ? `rgba(115, 228, 219, ${0.2 + storyProgress * 0.25})`
                    : `rgba(184, 255, 101, ${0.16 + storyProgress * 0.24})`;
                context.beginPath();
                context.arc(position.x, position.y, size, 0, Math.PI * 2);
                context.fill();
            });

            frame = window.requestAnimationFrame(draw);
        }

        window.addEventListener("pointermove", (event) => {
            pointer.x = event.clientX / Math.max(width, 1);
            pointer.y = event.clientY / Math.max(height, 1);
        }, { passive: true });
        window.addEventListener("resize", resize, { passive: true });
        document.addEventListener("visibilitychange", () => {
            visible = !document.hidden;
            if (visible) {
                window.cancelAnimationFrame(frame);
                frame = window.requestAnimationFrame(draw);
            }
        });

        resize();
        frame = window.requestAnimationFrame(draw);
    }

    function initGsap() {
        if (!window.gsap || !window.ScrollTrigger || reducedMotion.matches) return;

        const gsap = window.gsap;
        const ScrollTrigger = window.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        gsap.set(".hero-title .title-line", { yPercent: 115, rotate: 2 });
        gsap.set(".hero-title", { overflow: "hidden" });
        const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
        intro
            .to(".hero-title .title-line", { yPercent: 0, rotate: 0, duration: 0.15, stagger: 0.12 })
            .from(".hero .reveal", { opacity: 0, y: 22, duration: 0.3, stagger: 0.15 }, "-=0.7")
            .from(".scroll-cue, .hero-index", { opacity: 0, duration: 0.3 }, "-=0.45");

        gsap.to("[data-form-number]", {
            textContent: 5,
            snap: { textContent: 1 },
            ease: "none",
            scrollTrigger: { trigger: "main", start: "top top", end: "bottom bottom", scrub: true }
        });

        gsap.from(".chapter-heading > *", {
            opacity: 0,
            y: 36,
            stagger: 0.12,
            scrollTrigger: { trigger: ".lineage-layout", start: "top 70%", end: "top 38%", scrub: 1 }
        });
        gsap.fromTo(".browser-frame",
            { rotateX: 12, rotateY: -8, scale: 0.83, opacity: 0.2 },
            {
                rotateX: 0, rotateY: 0, scale: 1, opacity: 1, ease: "none",
                scrollTrigger: { trigger: ".archive-stage", start: "top 85%", end: "center 50%", scrub: 1 }
            }
        );

        const desktop = window.matchMedia("(min-width: 901px)");
        const setupDesktop = () => {
            const cleanups = [];

            const systemsTimeline = gsap.timeline({
                scrollTrigger: {
                    trigger: ".systems",
                    start: "top top",
                    end: "+=150%",
                    pin: ".sticky-scene",
                    scrub: 1,
                    anticipatePin: 1
                }
            });
            systemsTimeline
                .from(".capability-copy > *", { opacity: 0, y: 36, stagger: 0.08 })
                .from(".system-core", { scale: 0, opacity: 0 }, 0)
                .from(".system-visual svg circle", { attr: { r: 0 }, stagger: 0.1 }, 0.1)
                .from(".orbit", { scale: 0.3, opacity: 0, stagger: 0.15 }, 0.1)
                .to(".orbit-a", { rotation: 120, ease: "none" }, 0)
                .to(".orbit-b", { rotation: -90, ease: "none" }, 0)
                .from(".trait-list li", { opacity: 0, x: -25, stagger: 0.08 }, 0.35);

            const worldsTimeline = gsap.timeline({
                scrollTrigger: {
                    trigger: ".worlds",
                    start: "top top",
                    end: "bottom bottom",
                    pin: ".worlds-pin",
                    scrub: 1,
                    anticipatePin: 1
                }
            });
            worldsTimeline
                .from(".worlds-copy > *", { opacity: 0, y: 45, stagger: 0.1 })
                .from(".world-card-main", { xPercent: 80, rotateY: -22, opacity: 0 }, 0)
                .from(".world-card:nth-child(2)", { xPercent: 130, yPercent: -30, opacity: 0 }, 0.22)
                .from(".world-card:nth-child(3)", { xPercent: 110, yPercent: 35, opacity: 0 }, 0.4)
                .to(".world-gallery", { rotateY: 4, xPercent: -4, ease: "none" });

            const galleryTrack = document.querySelector(".gallery-track");
            const gallery = document.querySelector(".gallery");
            const horizontalDistance = () => Math.max(galleryTrack.scrollWidth - window.innerWidth, 0);
            const galleryTween = gsap.to(galleryTrack, {
                x: () => -horizontalDistance(),
                ease: "none",
                scrollTrigger: {
                    trigger: gallery,
                    start: "top top",
                    end: () => `+=${horizontalDistance() + window.innerWidth * 0.45}`,
                    pin: true,
                    scrub: 1,
                    invalidateOnRefresh: true,
                    anticipatePin: 1
                }
            });

            cleanups.push(() => systemsTimeline.scrollTrigger?.kill(), () => systemsTimeline.kill());
            cleanups.push(() => worldsTimeline.scrollTrigger?.kill(), () => worldsTimeline.kill());
            cleanups.push(() => galleryTween.scrollTrigger?.kill(), () => galleryTween.kill());
            return () => cleanups.forEach((cleanup) => cleanup());
        };

        let desktopCleanup = null;
        const handleDesktop = () => {
            desktopCleanup?.();
            desktopCleanup = desktop.matches ? setupDesktop() : null;
            ScrollTrigger.refresh();
        };
        desktop.addEventListener("change", handleDesktop);
        handleDesktop();

        const scaleItems = gsap.utils.toArray(".scale-copy li");
        scaleItems.forEach((item, index) => {
            gsap.to(item, {
                opacity: 1,
                x: 0,
                scrollTrigger: {
                    trigger: item,
                    start: "top 72%",
                    end: "bottom 48%",
                    scrub: 1,
                    onEnter: () => gsap.to(`.scale-ring:nth-child(-n+${index + 2})`, { borderColor: "rgba(184,255,101,.48)", duration: 0.4 }),
                    onLeaveBack: () => gsap.to(".scale-ring", { borderColor: "rgba(210,230,216,.17)", duration: 0.35 })
                }
            });
        });
        gsap.to(".scale-rings", {
            rotation: 28,
            ease: "none",
            scrollTrigger: { trigger: ".scale-stage", start: "top bottom", end: "bottom top", scrub: 1 }
        });

        gsap.from(".world-impact", {
            opacity: 0,
            y: 60,
            scrollTrigger: { trigger: ".world-impact", start: "top 85%", end: "top 48%", scrub: 1 }
        });
        gsap.to(".current-form", {
            rotation: 90,
            scale: 1.12,
            ease: "none",
            scrollTrigger: { trigger: ".current", start: "top bottom", end: "bottom bottom", scrub: 1 }
        });
    }

    initCanvas();
    initGsap();
})();