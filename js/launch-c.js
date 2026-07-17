(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function byId(id) {
        try {
            return document.getElementById(id);
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    function cssVar(name, fallback) {
        try {
            var raw = getComputedStyle(document.documentElement).getPropertyValue(name);
            var val = raw ? raw.trim() : "";
            return val || fallback || "";
        } catch (err) {
            console.error(err);
            return fallback || "";
        }
    }

    function initCursor() {
        var dot = byId("cursor-dot");
        var ring = byId("cursor-ring");
        if (!dot || !ring || reduceMotion) return;

        var mouseX = window.innerWidth / 2;
        var mouseY = window.innerHeight / 2;
        var ringX = mouseX;
        var ringY = mouseY;
        var raf = 0;

        function render() {
            ringX += (mouseX - ringX) * 0.2;
            ringY += (mouseY - ringY) * 0.2;
            dot.style.left = mouseX + "px";
            dot.style.top = mouseY + "px";
            ring.style.left = ringX + "px";
            ring.style.top = ringY + "px";
            raf = window.requestAnimationFrame(render);
        }

        window.addEventListener("pointermove", function (event) {
            mouseX = event.clientX;
            mouseY = event.clientY;
        }, { passive: true });

        document.addEventListener("pointerleave", function () {
            dot.style.opacity = "0";
            ring.style.opacity = "0";
        }, { passive: true });

        document.addEventListener("pointerenter", function () {
            dot.style.opacity = "1";
            ring.style.opacity = "1";
        }, { passive: true });

        document.querySelectorAll("button, a").forEach(function (el) {
            el.addEventListener("mouseenter", function () {
                ring.classList.add("is-hover");
            });
            el.addEventListener("mouseleave", function () {
                ring.classList.remove("is-hover");
            });
        });

        render();

        window.addEventListener("beforeunload", function () {
            if (raf) window.cancelAnimationFrame(raf);
        });
    }

    function initMagnetic() {
        if (reduceMotion) return;
        var magnets = document.querySelectorAll(".magnetic");
        if (!magnets.length) return;

        magnets.forEach(function (el) {
            el.addEventListener("pointermove", function (event) {
                var rect = el.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                var dx = (event.clientX - rect.left - rect.width / 2) / rect.width;
                var dy = (event.clientY - rect.top - rect.height / 2) / rect.height;
                el.style.setProperty("--mx", (dx * 10).toFixed(2) + "px");
                el.style.setProperty("--my", (dy * 10).toFixed(2) + "px");
            });

            el.addEventListener("pointerleave", function () {
                el.style.setProperty("--mx", "0px");
                el.style.setProperty("--my", "0px");
            });
        });
    }

    function initHeroKinetic() {
        var title = byId("hero-title");
        if (!title || reduceMotion) return;
        var lineA = title.querySelector(".line-a");
        var lineB = title.querySelector(".line-b");
        if (!lineA || !lineB) return;

        window.addEventListener("pointermove", function (event) {
            var nx = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
            var ny = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
            lineA.style.transform = "translate3d(" + (nx * -10).toFixed(2) + "px," + (ny * -8).toFixed(2) + "px,0)";
            lineB.style.transform = "translate3d(" + (nx * 16).toFixed(2) + "px," + (ny * 9).toFixed(2) + "px,0)";
        }, { passive: true });
    }

    function initMonoGrid() {
        var canvas = byId("mono-grid");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        if (!ctx) return;

        var width = 0;
        var height = 0;
        var dpr = 1;
        var raf = 0;
        var sweep = 0;

        function resize() {
            dpr = window.devicePixelRatio || 1;
            width = Math.max(1, Math.floor(window.innerWidth));
            height = Math.max(1, Math.floor(window.innerHeight));
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function drawGrid() {
            var gap = width > 900 ? 48 : 34;
            ctx.strokeStyle = cssVar("--grid-line", "rgba(255,255,255,0.06)");
            ctx.lineWidth = 1;
            for (var x = 0; x <= width; x += gap) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (var y = 0; y <= height; y += gap) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }

        function drawSweep() {
            sweep += 0.009;
            var centerX = width * (0.5 + Math.sin(sweep) * 0.18);
            var centerY = height * (0.45 + Math.cos(sweep * 1.4) * 0.12);
            var radius = Math.max(width, height) * 0.38;
            var grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            grad.addColorStop(0, cssVar("--grid-sweep-core", "rgba(255,255,255,0.14)"));
            grad.addColorStop(0.3, cssVar("--grid-sweep-mid", "rgba(255,255,255,0.05)"));
            grad.addColorStop(1, cssVar("--grid-sweep-end", "rgba(255,255,255,0)"));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            drawGrid();
            drawSweep();
            if (!reduceMotion) {
                raf = window.requestAnimationFrame(render);
            }
        }

        window.addEventListener("resize", resize);
        resize();
        render();

        window.addEventListener("beforeunload", function () {
            if (raf) window.cancelAnimationFrame(raf);
        });
    }

    function initSnapRail() {
        var root = byId("snap-root");
        var railLabel = byId("rail-label");
        var dots = document.querySelectorAll(".rail-dot");
        var panels = document.querySelectorAll(".panel[data-panel]");
        if (!root || !dots.length || !panels.length) return;

        var activeIndex = 0;
        var scrollingLock = false;

        function setActive(index) {
            activeIndex = index;
            dots.forEach(function (dot) {
                dot.classList.toggle("is-active", dot.getAttribute("data-panel-target") === String(index));
            });
            panels.forEach(function (panel) {
                panel.classList.toggle("is-active", panel.getAttribute("data-panel") === String(index));
            });
            if (railLabel) {
                var current = String(index + 1).padStart(2, "0");
                var total = String(panels.length).padStart(2, "0");
                railLabel.textContent = current + " / " + total;
            }
        }

        function scrollToIndex(index) {
            var safeIndex = clamp(index, 0, panels.length - 1);
            var panel = root.querySelector(".panel[data-panel=\"" + safeIndex + "\"]");
            if (!panel) return;
            panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }

        dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
                var target = parseInt(dot.getAttribute("data-panel-target") || "", 10);
                if (!Number.isFinite(target)) return;
                scrollToIndex(target);
            });
        });

        if ("IntersectionObserver" in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var raw = entry.target.getAttribute("data-panel");
                    var idx = parseInt(raw || "", 10);
                    if (Number.isFinite(idx)) setActive(idx);
                });
            }, {
                root: root,
                threshold: 0.58
            });
            panels.forEach(function (panel) { observer.observe(panel); });
        } else {
            setActive(0);
        }

        root.addEventListener("wheel", function () {
            scrollingLock = true;
            window.clearTimeout(root.__wheelTimer);
            root.__wheelTimer = window.setTimeout(function () {
                scrollingLock = false;
            }, 160);
        }, { passive: true });

        window.addEventListener("keydown", function (event) {
            var activeEl = document.activeElement;
            if (activeEl && /^(input|textarea|select)$/i.test(activeEl.tagName)) {
                return;
            }
            if (scrollingLock) return;
            if (event.key === "ArrowDown" || event.key === "PageDown") {
                event.preventDefault();
                scrollToIndex(activeIndex + 1);
            } else if (event.key === "ArrowUp" || event.key === "PageUp") {
                event.preventDefault();
                scrollToIndex(activeIndex - 1);
            } else if (event.key === "Home") {
                event.preventDefault();
                scrollToIndex(0);
            } else if (event.key === "End") {
                event.preventDefault();
                scrollToIndex(panels.length - 1);
            }
        });

        setActive(0);
    }

    function initCounters() {
        var counters = document.querySelectorAll("[data-counter]");
        if (!counters.length) return;

        function animate(el) {
            if (el.dataset.done === "1") return;
            var raw = el.getAttribute("data-counter");
            if (!raw) return;
            var target = parseFloat(raw);
            if (!Number.isFinite(target)) return;

            var start = performance.now();
            var duration = 1250;
            var decimals = raw.indexOf(".") >= 0 ? (raw.split(".")[1] || "").length : 0;
            el.dataset.done = "1";

            function frame(now) {
                var t = clamp((now - start) / duration, 0, 1);
                var eased = 1 - Math.pow(1 - t, 3);
                var value = target * eased;
                el.textContent = decimals > 0 ? value.toFixed(decimals) : String(Math.floor(value));
                if (t < 1) window.requestAnimationFrame(frame);
            }
            window.requestAnimationFrame(frame);
        }

        if (!("IntersectionObserver" in window)) {
            counters.forEach(animate);
            return;
        }

        var observer = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                animate(entry.target);
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.4 });

        counters.forEach(function (counter) { observer.observe(counter); });
    }

    function initScrollProgress() {
        var root = byId("snap-root");
        var bar = byId("scroll-progress");
        if (!root || !bar) return;

        function update() {
            var max = Math.max(1, root.scrollHeight - root.clientHeight);
            var ratio = clamp(root.scrollTop / max, 0, 1);
            bar.style.width = (ratio * 100).toFixed(2) + "%";
        }

        root.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        update();
    }

    function initSectionButtons() {
        var root = byId("snap-root");
        var explore = byId("top-explore-btn");
        if (explore && root) {
            explore.addEventListener("click", function () {
                root.scrollTo({ top: window.innerHeight, behavior: reduceMotion ? "auto" : "smooth" });
            });
        }
    }

    function initBoot() {
        var overlay = byId("boot-overlay");
        var fill = byId("boot-progress-fill");
        var pct = byId("boot-progress-text");
        var steps = document.querySelectorAll("#boot-steps li");
        if (!overlay || !fill || !pct || !steps.length) return;

        var ids = ["top-enter-btn", "hero-enter-btn", "final-enter-btn"];
        var booting = false;

        function setStep(idx) {
            steps.forEach(function (step, index) {
                step.classList.toggle("is-active", index <= idx);
            });
        }

        function startBoot() {
            if (booting) return;
            booting = true;
            overlay.classList.add("is-open");
            overlay.setAttribute("aria-hidden", "false");

            var current = 0;
            var marks = [20, 48, 76, 100];
            var stepIndex = -1;

            var timer = window.setInterval(function () {
                current += Math.max(1, Math.round((100 - current) * 0.09));
                current = clamp(current, 0, 100);
                fill.style.width = current + "%";
                pct.textContent = current + "%";

                var next = marks.findIndex(function (mark) { return current <= mark; });
                if (next !== -1 && next > stepIndex) {
                    stepIndex = next;
                    setStep(stepIndex);
                }

                if (current >= 100) {
                    window.clearInterval(timer);
                    setStep(steps.length - 1);
                    window.setTimeout(function () {
                        window.location.href = "studio.html";
                    }, 440);
                }
            }, 120);
        }

        ids.forEach(function (id) {
            var btn = byId(id);
            if (!btn) return;
            btn.addEventListener("click", startBoot);
        });
    }

    function init() {
        try { initCursor(); } catch (err) { console.error(err); }
        try { initMagnetic(); } catch (err) { console.error(err); }
        try { initHeroKinetic(); } catch (err) { console.error(err); }
        try { initMonoGrid(); } catch (err) { console.error(err); }
        try { initSnapRail(); } catch (err) { console.error(err); }
        try { initCounters(); } catch (err) { console.error(err); }
        try { initScrollProgress(); } catch (err) { console.error(err); }
        try { initSectionButtons(); } catch (err) { console.error(err); }
        try { initBoot(); } catch (err) { console.error(err); }
    }

    document.addEventListener("DOMContentLoaded", init);
})();

