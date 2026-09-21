/* ==================================================================
   MELIAN · 21·09·2026
   Motor de la experiencia. Sin dependencias externas.
   ================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------
     0. UTILIDADES
  --------------------------------------------------------- */
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const isSmall = window.innerWidth < 720;
  const perfTier = isTouch || isSmall ? "mobile" : "desktop";

  if (isTouch) document.body.classList.add("touch-device");

  /* Textura de grano sutil sobre toda la experiencia */
  const grain = document.createElement("div");
  grain.className = "grain-overlay";
  document.body.appendChild(grain);

  /* ---------------------------------------------------------
     1. CURSOR PERSONALIZADO
  --------------------------------------------------------- */
  const cursorDot = qs("#cursor-dot");
  const cursorHalo = qs("#cursor-halo");

  if (!isTouch) {
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let hx = cx, hy = cy;

    window.addEventListener("pointermove", (e) => {
      cx = e.clientX; cy = e.clientY;
      cursorDot.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
    }, { passive: true });

    (function haloLoop() {
      hx += (cx - hx) * 0.18;
      hy += (cy - hy) * 0.18;
      cursorHalo.style.transform = `translate(${hx}px, ${hy}px) translate(-50%,-50%)`;
      requestAnimationFrame(haloLoop);
    })();

    document.addEventListener("mouseleave", () => document.body.classList.add("no-cursor"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("no-cursor"));
  }

  function cursorNear(el, on) {
    if (isTouch) return;
    cursorHalo.classList.toggle("halo-flower", !!on);
  }
  function cursorMagnet(on) {
    if (isTouch) return;
    cursorHalo.classList.toggle("halo-magnet", !!on);
  }

  /* ---------------------------------------------------------
     2. FONDO AMBIENTAL — estrellas y polen (canvas)
  --------------------------------------------------------- */
  const bgCanvas = qs("#bg-canvas");
  const bgCtx = bgCanvas.getContext("2d");
  let bw, bh, dpr;

  // En móvil no necesitamos el doble de resolución para algo tan sutil
  // como polvo de polen: bajar el dpr es la ganancia de rendimiento más
  // grande y barata que existe para canvas en pantalla completa.
  function sizeCanvas(canvas, ctx, maxDpr) {
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }
  const BG_MAX_DPR = perfTier === "mobile" ? 1 : 2;
  ({ w: bw, h: bh } = sizeCanvas(bgCanvas, bgCtx, BG_MAX_DPR));

  const STAR_COUNT = perfTier === "mobile" ? 34 : 90;
  const POLLEN_COUNT = perfTier === "mobile" ? 8 : 20;

  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: rand(0, bw), y: rand(0, bh * 0.75),
    r: rand(0.4, 1.4),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.4, 1.1),
  }));

  const pollen = Array.from({ length: POLLEN_COUNT }, () => ({
    x: rand(0, bw), y: rand(bh * 0.3, bh),
    r: rand(0.8, 2.2),
    vy: -rand(4, 12) / 60,
    vx: rand(-4, 4) / 60,
    phase: rand(0, Math.PI * 2),
    alpha: rand(0.15, 0.55),
  }));

  // Sprite de polen pre-renderizado una sola vez: en vez de crear un
  // radial-gradient nuevo por partícula en cada cuadro (muy costoso),
  // dibujamos un único círculo difuminado a un canvas auxiliar y luego
  // solo lo "estampamos" (drawImage) en cada posición. Mismo resultado
  // visual, una fracción del costo.
  const POLLEN_SPRITE_SIZE = 24;
  const pollenSprite = document.createElement("canvas");
  pollenSprite.width = POLLEN_SPRITE_SIZE;
  pollenSprite.height = POLLEN_SPRITE_SIZE;
  (function paintPollenSprite() {
    const c = pollenSprite.getContext("2d");
    const r = POLLEN_SPRITE_SIZE / 2;
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(244,211,94,1)");
    g.addColorStop(1, "rgba(244,211,94,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(r, r, r, 0, Math.PI * 2);
    c.fill();
  })();

  let bgTime = 0;
  let ambientIntensity = 0.5; // sube en escenas de jardín/celebración
  let bgLoopActive = true;
  let lastFrameAt = 0;
  const BG_FRAME_INTERVAL = perfTier === "mobile" ? 1000 / 30 : 0; // limitar a ~30fps en móvil

  function drawBg(now) {
    if (!bgLoopActive) return;

    if (BG_FRAME_INTERVAL) {
      if (now - lastFrameAt < BG_FRAME_INTERVAL) {
        requestAnimationFrame(drawBg);
        return;
      }
      lastFrameAt = now;
    }

    bgCtx.clearRect(0, 0, bw, bh);
    bgTime += 1;

    stars.forEach((s) => {
      const tw = 0.55 + Math.sin(bgTime * 0.01 * s.speed + s.phase) * 0.45;
      bgCtx.beginPath();
      bgCtx.fillStyle = `rgba(244,235,221,${(0.18 + tw * 0.3) * ambientIntensity + 0.05})`;
      bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      bgCtx.fill();
    });

    pollen.forEach((p) => {
      p.y += p.vy;
      p.x += p.vx + Math.sin(bgTime * 0.008 + p.phase) * 0.15;
      if (p.y < -10) { p.y = bh + 10; p.x = rand(0, bw); }
      if (p.x < -10) p.x = bw + 10;
      if (p.x > bw + 10) p.x = -10;
      const outR = p.r * 4; // mismo radio visual que la versión con gradiente
      bgCtx.globalAlpha = p.alpha * ambientIntensity;
      bgCtx.drawImage(pollenSprite, p.x - outR, p.y - outR, outR * 2, outR * 2);
      bgCtx.globalAlpha = 1;
    });

    if (!reducedMotion) requestAnimationFrame(drawBg);
  }
  requestAnimationFrame(drawBg);
  if (reducedMotion) setInterval(() => drawBg(performance.now()), 4000);

  // pausar por completo cuando la pestaña no es visible
  document.addEventListener("visibilitychange", () => {
    bgLoopActive = !document.hidden;
    if (bgLoopActive && !reducedMotion) requestAnimationFrame(drawBg);
  });

  window.addEventListener("resize", () => {
    ({ w: bw, h: bh } = sizeCanvas(bgCanvas, bgCtx, BG_MAX_DPR));
  });

  /* ---------------------------------------------------------
     3. AUDIO AMBIENTAL — Web Audio API (sin archivos)
  --------------------------------------------------------- */
  const audioBtn = qs("#audio-toggle");
  let audioCtx = null, audioNodes = null, audioOn = false;

  function buildAmbientAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const drones = [98, 147, 196].map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.05 + i * 0.01;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(master);
      osc.start(); lfo.start();
      return { osc, gain, lfo };
    });

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    master.disconnect();
    master.connect(filter);
    filter.connect(ctx.destination);

    return { ctx, master, drones };
  }

  function playChime() {
    if (!audioOn || !audioCtx) return;
    const ctx = audioCtx;
    const notes = [523.25, 659.25, 783.99];
    const freq = pick(notes);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioNodes.master);
    const now = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0.045, now + 0.4);
    gain.gain.linearRampToValueAtTime(0, now + 2.4);
    osc.start(now);
    osc.stop(now + 2.5);
  }

  audioBtn.addEventListener("click", async () => {
    if (!audioCtx) {
      audioNodes = buildAmbientAudio();
      audioCtx = audioNodes.ctx;
    }
    if (audioCtx.state === "suspended") await audioCtx.resume();

    audioOn = !audioOn;
    audioBtn.setAttribute("aria-pressed", String(audioOn));
    qs(".audio-label", audioBtn).textContent = audioOn ? "silenciar ambiente" : "activar ambiente";
    const target = audioOn ? 0.5 : 0;
    audioNodes.master.gain.cancelScheduledValues(audioCtx.currentTime);
    audioNodes.master.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 1.6);
  });

  /* ---------------------------------------------------------
     4. REVELADO DE LÍNEAS DE TEXTO
  --------------------------------------------------------- */
  function revealLines(container, { stagger = 650, startDelay = 300 } = {}) {
    const lines = qsa(".line[data-line]", container);
    lines.forEach((el) => el.classList.remove("line-in"));
    return new Promise((resolve) => {
      lines.forEach((el, i) => {
        setTimeout(() => el.classList.add("line-in"), startDelay + i * stagger);
      });
      setTimeout(resolve, startDelay + lines.length * stagger + 600);
    });
  }

  /* ---------------------------------------------------------
     5. FÁBRICA DE FLORES (SVG procedural)
  --------------------------------------------------------- */
  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  let flowerUID = 0;

  /**
   * Crea una flor SVG procedural con pétalos, centro detallado, luz y sombra.
   * variant: "primary" | "secondary" | "small" | "secret" | "final"
   */
  function createFlowerSVG(variant = "secondary", opts = {}) {
    flowerUID += 1;
    const id = `fl${flowerUID}`;
    const petals = opts.petals || (variant === "small" ? 5 : randInt(6, 8));
    const size = opts.size || { primary: 132, secondary: 102, small: 62, secret: 168, final: 220 }[variant] || 96;
    const petalColor = opts.petalColor || pick(["#F4D35E", "#E9B949", "#F1C64C"]);
    const petalColorDeep = opts.petalColorDeep || "#C79A3B";
    const centerColor = opts.centerColor || "#7A4E17";

    const svg = svgEl("svg", {
      viewBox: "0 0 200 200",
      width: size, height: size,
      "aria-hidden": "true",
    });

    const defs = svgEl("defs");
    const petalGrad = svgEl("radialGradient", { id: `pg-${id}`, cx: "50%", cy: "20%", r: "80%" });
    petalGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#FFF3CE" }));
    petalGrad.appendChild(svgEl("stop", { offset: "55%", "stop-color": petalColor }));
    petalGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": petalColorDeep }));
    defs.appendChild(petalGrad);

    const centerGrad = svgEl("radialGradient", { id: `cg-${id}`, cx: "42%", cy: "38%", r: "65%" });
    centerGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#B9781F" }));
    centerGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": centerColor }));
    defs.appendChild(centerGrad);

    const glow = svgEl("filter", { id: `gl-${id}`, x: "-60%", y: "-60%", width: "220%", height: "220%" });
    const blur = svgEl("feGaussianBlur", { stdDeviation: variant === "secret" || variant === "final" ? 9 : 5 });
    blur.setAttribute("result", "b");
    glow.appendChild(blur);
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "b" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    svg.appendChild(defs);

    const cx = 100, cy = 108;

    // halo/glow trasero (visible siempre de forma tenue, se intensifica al tocarla)
    const glowRadius = { final: 84, secret: 66, primary: 52, secondary: 42, small: 28 }[variant] || 42;
    const glowCircle = svgEl("circle", {
      cx, cy, r: glowRadius,
      fill: petalColor,
      opacity: 0.35,
      filter: `url(#gl-${id})`,
      class: "flower-glow",
    });
    svg.appendChild(glowCircle);

    // tallo
    const stem = svgEl("path", {
      d: `M ${cx} ${cy + 6} C ${cx - 4} ${cy + 40}, ${cx + 6} ${cy + 60}, ${cx} ${cy + 92}`,
      stroke: "#4B5A2E", "stroke-width": 3.4, fill: "none", "stroke-linecap": "round",
      opacity: 0.85,
    });
    svg.appendChild(stem);

    // una hojita
    const leaf = svgEl("path", {
      d: `M ${cx} ${cy + 52} C ${cx + 18} ${cy + 48}, ${cx + 26} ${cy + 62}, ${cx + 6} ${cy + 70} Z`,
      fill: "#5C6B37", opacity: 0.8,
    });
    svg.appendChild(leaf);

    // pétalos
    const petalGroup = svgEl("g", { class: "flower-petals" });
    const petalLen = {
      final: 74, secret: 62, primary: 46, secondary: 36, small: 26,
    }[variant] || 36;
    const petalWide = petalLen * 0.56;

    for (let i = 0; i < petals; i++) {
      const angle = (360 / petals) * i + rand(-4, 4);
      const p = svgEl("path", {
        d: `M ${cx} ${cy} C ${cx - petalWide} ${cy - petalLen * 0.4}, ${cx - petalWide * 0.6} ${cy - petalLen}, ${cx} ${cy - petalLen - petalLen * 0.15} C ${cx + petalWide * 0.6} ${cy - petalLen}, ${cx + petalWide} ${cy - petalLen * 0.4}, ${cx} ${cy}`,
        fill: `url(#pg-${id})`,
        stroke: petalColorDeep,
        "stroke-width": 0.6,
        "stroke-opacity": 0.35,
        transform: `rotate(${angle} ${cx} ${cy})`,
        class: "flower-petal",
        style: `transition-delay:${(i * 25)}ms`,
      });
      petalGroup.appendChild(p);
    }
    svg.appendChild(petalGroup);

    // centro
    const centerRadius = { final: 26, secret: 21, primary: 14, secondary: 12, small: 7 }[variant] || 12;
    const center = svgEl("circle", { cx, cy, r: centerRadius, fill: `url(#cg-${id})` });
    svg.appendChild(center);

    // textura de puntitos del centro
    const dotCount = variant === "small" ? 0 : 8;
    for (let i = 0; i < dotCount; i++) {
      const a = (Math.PI * 2 * i) / dotCount + rand(-0.1, 0.1);
      const r = centerRadius * rand(0.5, 0.95);
      const dot = svgEl("circle", {
        cx: cx + Math.cos(a) * r, cy: cy + Math.sin(a) * r,
        r: variant === "final" || variant === "secret" ? 1.8 : 1.1,
        fill: "#3E2A0F", opacity: 0.55,
      });
      center.parentNode === svg && svg.appendChild(dot);
    }

    return svg;
  }

  /* ---------------------------------------------------------
     6. FÁBRICA DEL PERRITO DE LA PRADERA (SVG)
  --------------------------------------------------------- */
  function createPrairieDogSVG({ withFlower = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "prairie-dog";
    wrap.setAttribute("aria-hidden", "true");

    const svg = svgEl("svg", { viewBox: "0 0 120 130", width: "100%" });

    const defs = svgEl("defs");
    const furGrad = svgEl("linearGradient", { id: "furGrad", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
    furGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#D8B27C" }));
    furGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#A9814F" }));
    defs.appendChild(furGrad);

    const bellyGrad = svgEl("linearGradient", { id: "bellyGrad", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
    bellyGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#F3E3C4" }));
    bellyGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#DEC292" }));
    defs.appendChild(bellyGrad);
    svg.appendChild(defs);

    const bodyGroup = svgEl("g", { class: "pd-body-group" });

    // sombra de contacto
    bodyGroup.appendChild(svgEl("ellipse", {
      cx: 60, cy: 122, rx: 30, ry: 6, fill: "#000", opacity: 0.28,
    }));

    // cuerpo
    bodyGroup.appendChild(svgEl("path", {
      d: "M 30 118 C 22 95, 26 68, 45 58 C 40 46, 46 32, 60 30 C 74 32, 80 46, 75 58 C 94 68, 98 95, 90 118 C 78 126, 42 126, 30 118 Z",
      fill: "url(#furGrad)",
    }));

    // vientre
    bodyGroup.appendChild(svgEl("path", {
      d: "M 42 116 C 38 98, 40 80, 60 78 C 80 80, 82 98, 78 116 C 68 122, 52 122, 42 116 Z",
      fill: "url(#bellyGrad)",
    }));

    // patitas delanteras
    bodyGroup.appendChild(svgEl("ellipse", { cx: 46, cy: 116, rx: 7, ry: 5, fill: "#B78F58" }));
    bodyGroup.appendChild(svgEl("ellipse", { cx: 74, cy: 116, rx: 7, ry: 5, fill: "#B78F58" }));

    // cabeza
    const head = svgEl("g", { class: "pd-head" });
    head.appendChild(svgEl("path", {
      d: "M 60 12 C 78 12, 88 26, 86 42 C 84 56, 72 62, 60 62 C 48 62, 36 56, 34 42 C 32 26, 42 12, 60 12 Z",
      fill: "url(#furGrad)",
    }));
    // mejillas
    head.appendChild(svgEl("ellipse", { cx: 42, cy: 46, rx: 8, ry: 7, fill: "#EBD5A8", opacity: 0.9 }));
    head.appendChild(svgEl("ellipse", { cx: 78, cy: 46, rx: 8, ry: 7, fill: "#EBD5A8", opacity: 0.9 }));

    // orejas
    const earL = svgEl("ellipse", { cx: 40, cy: 16, rx: 6, ry: 8, fill: "#A9814F", class: "pd-ear-l" });
    const earR = svgEl("ellipse", { cx: 80, cy: 16, rx: 6, ry: 8, fill: "#A9814F", class: "pd-ear-r" });
    head.appendChild(earL);
    head.appendChild(earR);

    // hocico
    head.appendChild(svgEl("ellipse", { cx: 60, cy: 50, rx: 9, ry: 7, fill: "#F3E3C4" }));
    head.appendChild(svgEl("circle", { cx: 60, cy: 47, r: 2.1, fill: "#3E2A16" }));

    // boca
    const mouth = svgEl("path", { d: "M 54 54 Q 60 58, 66 54", stroke: "#5C3D1B", "stroke-width": 1.6, fill: "none", "stroke-linecap": "round", class: "pd-mouth" });
    head.appendChild(mouth);

    // ojos
    const eyeL = svgEl("circle", { cx: 48, cy: 38, r: 4.6, fill: "#241708" });
    const eyeR = svgEl("circle", { cx: 72, cy: 38, r: 4.6, fill: "#241708" });
    const shineL = svgEl("circle", { cx: 49.4, cy: 36.3, r: 1.3, fill: "#FFF9ED" });
    const shineR = svgEl("circle", { cx: 73.4, cy: 36.3, r: 1.3, fill: "#FFF9ED" });
    head.appendChild(eyeL); head.appendChild(shineL);
    head.appendChild(eyeR); head.appendChild(shineR);

    // párpados (parpadeo)
    const lidL = svgEl("path", { d: "M 43 38 Q 48 32, 53 38 Q 48 40, 43 38 Z", fill: "#A9814F", class: "pd-eyelid-l" });
    const lidR = svgEl("path", { d: "M 67 38 Q 72 32, 77 38 Q 72 40, 67 38 Z", fill: "#A9814F", class: "pd-eyelid-r" });
    head.appendChild(lidL); head.appendChild(lidR);

    // dientitos
    head.appendChild(svgEl("rect", { x: 58, y: 52, width: 4, height: 5, rx: 1, fill: "#FFF9ED" }));

    bodyGroup.appendChild(head);

    // brazos sosteniendo flor
    const flowerProp = svgEl("g", { class: "pd-flower-prop" });
    flowerProp.appendChild(svgEl("ellipse", { cx: 60, cy: 100, rx: 9, ry: 6, fill: "#B78F58" }));
    const miniFlower = createFlowerSVG("small", { size: 34 });
    miniFlower.setAttribute("x", "43");
    miniFlower.setAttribute("y", "70");
    const flowerForeign = svgEl("g", { transform: "translate(43,66) scale(0.42)" });
    // clonar contenido interno del mini-flower dentro del grupo (mismo namespace)
    Array.from(miniFlower.childNodes).forEach((n) => flowerForeign.appendChild(n.cloneNode(true)));
    flowerProp.appendChild(flowerForeign);
    bodyGroup.appendChild(flowerProp);

    svg.appendChild(bodyGroup);
    wrap.appendChild(svg);

    if (withFlower) wrap.classList.add("pd-holding");

    return wrap;
  }

  /* ---------------------------------------------------------
     7. GESTOR DE ESCENAS
  --------------------------------------------------------- */
  const scenes = {};
  qsa(".scene").forEach((s) => (scenes[s.dataset.scene] = s));
  let currentScene = null;

  async function goToScene(name, { instant = false } = {}) {
    const next = scenes[name];
    if (!next || next === currentScene) return;
    const prev = currentScene;

    if (prev) {
      prev.classList.remove("scene-visible");
      if (!instant) {
        prev.classList.add("scene-leaving");
        await wait(650);
      }
      prev.classList.remove("active", "scene-leaving");
    }

    next.classList.add("active");
    // forzar reflow para reiniciar animación
    void next.offsetWidth;
    next.classList.add("scene-visible");
    currentScene = next;
    window.scrollTo(0, 0);

    onSceneEnter(name);
  }

  function onSceneEnter(name) {
    switch (name) {
      case "void": initVoidScene(); break;
      case "bloom": initBloomScene(); break;
      case "garden": initGardenScene(); break;
      case "gift": initGiftScene(); break;
      case "secret": initSecretScene(); break;
      case "future": initFutureScene(); break;
      case "letter": initLetterScene(); break;
      case "question": initQuestionScene(); break;
      case "celebration": initCelebrationScene(); break;
      case "sky": initSkyScene(); break;
    }
  }

  /* ---------------------------------------------------------
     8. ESCENA · VOID
  --------------------------------------------------------- */
  let voidStarted = false;
  function initVoidScene() {
    if (voidStarted) return;
    voidStarted = true;
    const star = qs(".void-star");
    const door = qs("#enter-door");

    setTimeout(() => star.classList.add("star-in"), 500);
    revealLines(qs("#scene-void")).then(() => {
      setTimeout(() => door.classList.add("door-in"), 300);
    });

    const enter = async () => {
      door.classList.add("door-open");
      ambientIntensity = 0.7;
      await wait(750);
      goToScene("bloom");
    };
    door.addEventListener("click", enter, { once: true });
  }

  /* ---------------------------------------------------------
     9. ESCENA · BLOOM (el jardín nace)
  --------------------------------------------------------- */
  let bloomStarted = false;
  function initBloomScene() {
    if (bloomStarted) return;
    bloomStarted = true;
    const ground = qs("#bloom-ground");
    setTimeout(() => ground.classList.add("ground-in"), 350);
    revealLines(qs("#scene-bloom"), { stagger: 900, startDelay: 700 }).then(async () => {
      await wait(1400);
      goToScene("garden");
    });
  }

  /* ---------------------------------------------------------
     10. ESCENA · JARDÍN INTERACTIVO
  --------------------------------------------------------- */
  const FLOWER_MESSAGES = shuffle([
    "Esta es porque sí.",
    "Esta porque me acordé de ti.",
    "Esta porque una sola nunca iba a ser suficiente.",
    "Esta porque hoy quería hacerte sonreír.",
    "Esta porque todavía nos quedan muchos lugares por conocer.",
    "Esta porque me gusta imaginar nuestro futuro.",
    "Esta porque quiero seguir compartiendo contigo días que todavía no existen.",
    "Me gusta pensar que todavía nos quedan muchísimas versiones de nosotros por conocer.",
    "Quiero estar para las cosas importantes y también para las absurdamente pequeñas.",
    "Todavía quiero conocer lugares contigo.",
    "Todavía quiero descubrir qué cosas nos harán reír dentro de unos años.",
    "No quiero solamente celebrar los días especiales. También quiero estar en los días normales.",
  ]);

  const FLOWER_PROMISES = shuffle([
    "Prometo seguir buscando razones para hacerte sonreír.",
    "Prometo que habrá más aventuras.",
    "Prometo que habrá más noches hablando hasta tarde.",
    "Prometo guardar espacio para las cosas que todavía soñamos.",
    "Prometo seguir haciendo pequeños esfuerzos para recordarte cuánto te quiero.",
  ]);

  const TOTAL_REGULAR_FLOWERS = FLOWER_MESSAGES.length; // 12
  const GIFT_TRIGGER_COUNT = 5;

  let gardenBuilt = false;
  let discoveredCount = 0;
  let giftShown = false;
  let secretRevealed = false;
  let secretFound = false;

  const FLOWER_LAYOUT = [
    { left: 8,  bottom: 10, variant: "secondary", scale: 1.0 },
    { left: 18, bottom: 22, variant: "small",     scale: 0.8 },
    { left: 27, bottom: 8,  variant: "primary",   scale: 1.15 },
    { left: 37, bottom: 26, variant: "small",     scale: 0.7 },
    { left: 46, bottom: 12, variant: "secondary", scale: 1.0 },
    { left: 55, bottom: 24, variant: "small",     scale: 0.75 },
    { left: 63, bottom: 9,  variant: "primary",   scale: 1.1 },
    { left: 72, bottom: 20, variant: "secondary", scale: 0.95 },
    { left: 81, bottom: 7,  variant: "small",     scale: 0.8 },
    { left: 90, bottom: 18, variant: "secondary", scale: 1.0 },
    { left: 14, bottom: 35, variant: "small",     scale: 0.6 },
    { left: 68, bottom: 33, variant: "small",     scale: 0.65 },
  ];

  function buildGarden() {
    const field = qs("#garden-field");
    field.innerHTML = "";

    FLOWER_LAYOUT.forEach((pos, i) => {
      const holder = document.createElement("div");
      holder.className = "flower";
      holder.style.left = pos.left + "%";
      holder.style.bottom = pos.bottom + "%";
      holder.style.setProperty("--tilt", `${rand(-4, 4)}deg`);
      holder.style.setProperty("--sway-dur", `${rand(4.5, 8)}s`);
      holder.style.setProperty("--sway-delay", `${rand(0, 3)}s`);
      holder.style.setProperty("transform", `scale(${pos.scale})`);
      holder.setAttribute("role", "button");
      holder.setAttribute("tabindex", "0");
      holder.setAttribute("aria-label", "Una flor del jardín");
      holder.dataset.index = i;
      holder.dataset.discovered = "0";

      const isPromise = i % 3 === 2 && FLOWER_PROMISES.length;
      holder.dataset.kind = isPromise ? "promesa" : "pensamiento";
      holder.dataset.text = isPromise
        ? FLOWER_PROMISES[(i / 3) | 0] || pick(FLOWER_PROMISES)
        : FLOWER_MESSAGES[i] || pick(FLOWER_MESSAGES);

      const svg = createFlowerSVG(pos.variant);
      holder.appendChild(svg);

      const activate = () => discoverFlower(holder);
      holder.addEventListener("click", activate);
      holder.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
      holder.addEventListener("pointerenter", () => cursorNear(holder, true));
      holder.addEventListener("pointerleave", () => cursorNear(holder, false));

      field.appendChild(holder);
    });
  }

  const messageCard = qs("#message-card");
  const messageText = qs("#message-text");
  const messageKind = qs("#message-kind");
  let messageTimer = null;

  function showMessage(text, kind) {
    clearTimeout(messageTimer);
    messageText.textContent = text;
    messageKind.textContent = kind === "promesa" ? "una promesa" : "un pensamiento";
    messageCard.classList.add("card-visible");
    messageTimer = setTimeout(() => messageCard.classList.remove("card-visible"), 4600);
  }

  async function discoverFlower(holder) {
    if (holder.dataset.discovered === "1") {
      showMessage(holder.dataset.text, holder.dataset.kind);
      return;
    }
    holder.dataset.discovered = "1";
    holder.classList.add("flower-active", "flower-discovered");
    showMessage(holder.dataset.text, holder.dataset.kind);
    playChime();

    if (holder.dataset.secret !== "1") {
      discoveredCount += 1;
      updateGardenCount();
      maybeTriggerDogPeek(holder);

      if (!giftShown && discoveredCount >= GIFT_TRIGGER_COUNT) {
        giftShown = true;
        await wait(1600);
        goToScene("gift");
        return;
      }
      if (!secretRevealed && discoveredCount >= 8) {
        secretRevealed = true;
        setTimeout(revealSecretFlowerHint, 1200);
      }
      checkGardenComplete();
    } else {
      secretFound = true;
      await wait(1300);
      goToScene("secret");
    }
  }

  function updateGardenCount() {
    const counter = qs("#garden-count");
    counter.innerHTML = `${discoveredCount} <span>/ ${TOTAL_REGULAR_FLOWERS} encontradas</span>`;
    const hint = qs("#garden-hint");
    if (discoveredCount === 1) hint.textContent = "hay más, sigue mirando";
    if (discoveredCount >= 4) hint.style.opacity = "0";
  }

  function checkGardenComplete() {
    if (discoveredCount >= TOTAL_REGULAR_FLOWERS && secretFound) {
      setTimeout(() => goToScene("future"), 1800);
    }
  }

  /* pista visual: corriente de polen dorado que lleva a la flor secreta */
  function revealSecretFlowerHint() {
    const field = qs("#garden-field");
    const secretPos = { left: 50, bottom: 46 };

    const trail = document.createElement("div");
    trail.className = "ambient-layer";
    trail.style.zIndex = "3";
    for (let i = 0; i < 10; i++) {
      const dot = document.createElement("span");
      const t = i / 9;
      dot.style.position = "absolute";
      dot.style.left = `${18 + t * (secretPos.left - 18)}%`;
      dot.style.bottom = `${14 + t * (secretPos.bottom - 14)}%`;
      dot.style.width = "4px"; dot.style.height = "4px";
      dot.style.borderRadius = "50%";
      dot.style.background = "#F4D35E";
      dot.style.opacity = "0";
      dot.style.boxShadow = "0 0 8px 2px rgba(244,211,94,.5)";
      dot.style.transition = `opacity 1s ease ${i * 0.15}s`;
      trail.appendChild(dot);
      requestAnimationFrame(() => setTimeout(() => (dot.style.opacity = "0.8"), 30));
    }
    field.appendChild(trail);

    const holder = document.createElement("div");
    holder.className = "flower";
    holder.style.left = secretPos.left + "%";
    holder.style.bottom = secretPos.bottom + "%";
    holder.style.setProperty("--tilt", "-3deg");
    holder.style.setProperty("--sway-dur", "7s");
    holder.style.opacity = "0";
    holder.style.transition = "opacity 1.4s ease";
    holder.setAttribute("role", "button");
    holder.setAttribute("tabindex", "0");
    holder.setAttribute("aria-label", "Una flor distinta a las demás");
    holder.dataset.secret = "1";
    holder.dataset.discovered = "0";

    const svg = createFlowerSVG("secret", { petalColor: "#FFF3CE", petalColorDeep: "#E9B949" });
    holder.appendChild(svg);

    const activate = () => discoverFlower(holder);
    holder.addEventListener("click", activate);
    holder.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });

    field.appendChild(holder);
    setTimeout(() => (holder.style.opacity = "1"), 700);
  }

  /* ---- El perrito en el jardín: apariciones espontáneas ---- */
  let dogTimerHandle = null;
  const DOG_SPOTS = [
    { left: 12, bottom: 4 }, { left: 33, bottom: 4 }, { left: 58, bottom: 5 },
    { left: 76, bottom: 4 }, { left: 22, bottom: 30 }, { left: 84, bottom: 28 },
  ];

  function scheduleDogAppearances() {
    if (currentScene !== scenes.garden) return;
    const delay = reducedMotion ? 15000 : rand(6500, 13000);
    dogTimerHandle = setTimeout(() => {
      if (currentScene === scenes.garden) {
        showDogPeek();
        scheduleDogAppearances();
      }
    }, delay);
  }

  function showDogPeek(nearHolder = null) {
    const layer = qs("#dog-layer");
    if (qs(".prairie-dog", layer)) return; // ya hay uno visible

    const spot = nearHolder
      ? { left: parseFloat(nearHolder.style.left) + rand(-6, 6), bottom: 4 }
      : pick(DOG_SPOTS);

    const holdsFlower = Math.random() < 0.35;
    const dog = createPrairieDogSVG({ withFlower: holdsFlower });
    dog.style.left = clamp(spot.left, 4, 90) + "%";
    dog.style.bottom = spot.bottom + "%";
    dog.style.width = perfTier === "mobile" ? "70px" : "92px";
    dog.classList.add("pd-peek");
    layer.appendChild(dog);

    const life = reducedMotion ? 3200 : rand(2600, 4200);
    setTimeout(() => {
      dog.classList.remove("pd-peek");
      dog.classList.add("pd-hide");
      setTimeout(() => dog.remove(), 800);
    }, life);
  }

  function maybeTriggerDogPeek(holder) {
    if (Math.random() < 0.4) {
      clearTimeout(dogTimerHandle);
      setTimeout(() => { showDogPeek(holder); scheduleDogAppearances(); }, 500);
    }
  }

  function initGardenScene() {
    ambientIntensity = 0.9;
    if (!gardenBuilt) {
      buildGarden();
      gardenBuilt = true;
    }
    clearTimeout(dogTimerHandle);
    scheduleDogAppearances();
  }

  /* ---------------------------------------------------------
     11. ESCENA · ENTREGA DE LA FLOR
  --------------------------------------------------------- */
  let giftAdvanceTimer = null;
  function initGiftScene() {
    const slot = qs("#gift-dog-slot");
    slot.innerHTML = "";
    const dog = createPrairieDogSVG({ withFlower: false });
    dog.classList.add("pd-sit");
    slot.appendChild(dog);

    // el perrito extiende la flor tras la segunda línea
    setTimeout(() => dog.classList.add("pd-holding"), 2600);

    revealLines(qs("#scene-gift"), { stagger: 1500, startDelay: 500 });

    clearTimeout(giftAdvanceTimer);
    giftAdvanceTimer = setTimeout(async () => {
      await wait(1400);
      if (discoveredCount >= TOTAL_REGULAR_FLOWERS && secretFound) {
        goToScene("future");
      } else {
        goToScene("garden");
      }
    }, 8200);
  }

  /* ---------------------------------------------------------
     12. ESCENA · FLOR SECRETA
  --------------------------------------------------------- */
  function initSecretScene() {
    ambientIntensity = 1;
    const slot = qs("#secret-flower-slot");
    slot.innerHTML = "";
    const svg = createFlowerSVG("final", { petalColor: "#FFF3CE", petalColorDeep: "#E9B949" });
    svg.style.opacity = "0";
    svg.style.transform = "scale(.7)";
    svg.style.transition = "opacity 1.8s ease, transform 1.8s cubic-bezier(.16,.8,.24,1)";
    slot.appendChild(svg);
    requestAnimationFrame(() => {
      setTimeout(() => { svg.style.opacity = "1"; svg.style.transform = "scale(1)"; }, 200);
    });

    revealLines(qs("#scene-secret"), { stagger: 1600, startDelay: 1400 }).then(async () => {
      await wait(2200);
      goToScene("future");
    });
  }

  /* ---------------------------------------------------------
     13. ESCENA · LO QUE TODAVÍA NOS QUEDA
  --------------------------------------------------------- */
  const FUTURE_WORDS = ["Más lugares.", "Más noches.", "Más risas.", "Más abrazos.", "Más conversaciones.", "Más fotografías.", "Más tonterías.", "Más días normales.", "Más historias.", "Más nosotros."];

  function initFutureScene() {
    const field = qs("#future-field");
    field.innerHTML = "";
    const finalLine = qs("#future-final");
    finalLine.classList.remove("final-in");

    const spots = shuffle([
      { l: 18, t: 22 }, { l: 65, t: 18 }, { l: 30, t: 55 }, { l: 74, t: 48 },
      { l: 12, t: 68 }, { l: 55, t: 72 }, { l: 40, t: 30 }, { l: 80, t: 70 },
      { l: 22, t: 42 }, { l: 60, t: 60 },
    ]);

    FUTURE_WORDS.forEach((word, i) => {
      const el = document.createElement("p");
      el.className = "future-word";
      el.textContent = word;
      const s = spots[i % spots.length];
      el.style.left = s.l + "%";
      el.style.top = s.t + "%";
      field.appendChild(el);
      setTimeout(() => el.classList.add("word-in"), 500 + i * 850);
    });

    const totalTime = 500 + FUTURE_WORDS.length * 850 + 800;
    setTimeout(() => finalLine.classList.add("final-in"), totalTime);
    setTimeout(() => goToScene("letter"), totalTime + 3600);
  }

  /* ---------------------------------------------------------
     14. ESCENA · LA CARTA
  --------------------------------------------------------- */
  function initLetterScene() {
    const sheet = qs("#letter-sheet");
    requestAnimationFrame(() => setTimeout(() => sheet.classList.add("letter-in"), 200));
    qs("#letter-continue").onclick = () => goToScene("question");
  }

  /* ---------------------------------------------------------
     15. ESCENA · PREGUNTA JUGUETONA
  --------------------------------------------------------- */
  const NO_TAUNTS = [
    "Respuesta sospechosa.",
    "Voy a darte otra oportunidad.",
    "Melian…",
  ];
  let noClicks = 0;

  function initQuestionScene() {
    noClicks = 0;
    const yesBtn = qs("#q-yes");
    const noBtn = qs("#q-no");
    const taunt = qs("#question-taunt");
    const wrap = qs(".question-buttons");

    yesBtn.classList.remove("q-yes-big");
    noBtn.classList.remove("q-no-escaping");
    noBtn.style.left = ""; noBtn.style.top = "";
    taunt.textContent = ""; taunt.classList.remove("taunt-in");

    revealLines(qs("#scene-question"), { stagger: 700, startDelay: 300 });

    yesBtn.onclick = async () => {
      await wait(400);
      goToScene("celebration");
    };

    noBtn.onclick = (e) => {
      noClicks += 1;
      const msg = NO_TAUNTS[Math.min(noClicks - 1, NO_TAUNTS.length - 1)];
      taunt.textContent = msg;
      taunt.classList.add("taunt-in");

      if (noClicks >= NO_TAUNTS.length) {
        setTimeout(() => {
          taunt.textContent = "Está bien. Ya entendí.";
          noBtn.style.opacity = "0";
          noBtn.style.pointerEvents = "none";
          yesBtn.classList.add("q-yes-big");
        }, 900);
        return;
      }

      // el botón "escapa" del cursor
      const rect = wrap.getBoundingClientRect();
      noBtn.classList.add("q-no-escaping");
      const nx = clamp(rect.left + rand(0, rect.width) - 40, 20, window.innerWidth - 120);
      const ny = clamp(window.innerHeight * rand(0.4, 0.75), 80, window.innerHeight - 100);
      noBtn.style.left = nx + "px";
      noBtn.style.top = ny + "px";
    };

    noBtn.addEventListener("pointerenter", () => {
      if (noClicks > 0 && noClicks < NO_TAUNTS.length) {
        const nx = clamp(rand(60, window.innerWidth - 140), 20, window.innerWidth - 120);
        const ny = clamp(rand(120, window.innerHeight - 160), 80, window.innerHeight - 100);
        noBtn.style.left = nx + "px";
        noBtn.style.top = ny + "px";
      }
    });
  }

  /* ---------------------------------------------------------
     16. ESCENA · CELEBRACIÓN
  --------------------------------------------------------- */
  const CELEBRATION_EMOJI = ["🌼", "🌻", "🌸", "✨", "🍃"];

  // Las flores dibujadas a mano se notan poco cuando caen pequeñas y rápido,
  // así que aquí usamos emoji reales: son más legibles a simple vista y,
  // al ser texto en vez de SVG, resultan mucho más livianas de animar.
  function spawnCelebrationBurst() {
    if (!qs("#celebration-fall-style")) {
      const styleTag = document.createElement("style");
      styleTag.id = "celebration-fall-style";
      styleTag.textContent = `
        .petal-emoji{
          position: absolute;
          top: -8%;
          will-change: transform, opacity;
          line-height: 1;
          user-select: none;
        }
        @keyframes celebration-fall{
          0%{ transform: translate(0,0) rotate(0deg); opacity: 0; }
          8%{ opacity: 1; }
          100%{ transform: translate(var(--drift), 118vh) rotate(var(--spin)); opacity: 0; }
        }`;
      document.head.appendChild(styleTag);
    }

    const container = document.createElement("div");
    container.className = "ambient-layer";
    container.style.zIndex = "2";
    qs("#scene-celebration").appendChild(container);

    const n = perfTier === "mobile" ? 20 : 36;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < n; i++) {
      const piece = document.createElement("span");
      piece.className = "petal-emoji";
      piece.textContent = pick(CELEBRATION_EMOJI);
      piece.style.left = rand(0, 100) + "%";
      piece.style.fontSize = rand(16, 30) + "px";
      piece.style.opacity = String(rand(0.75, 1));
      piece.style.filter = `drop-shadow(0 0 6px rgba(244,211,94,.35))`;

      const dur = rand(4, 7.5);
      const delay = rand(0, 2.4);
      const drift = rand(-70, 70);
      const spin = rand(-220, 220);
      piece.style.setProperty("--drift", drift + "px");
      piece.style.setProperty("--spin", spin + "deg");
      piece.style.animation = reducedMotion
        ? "none"
        : `celebration-fall ${dur}s linear ${delay}s forwards`;
      frag.appendChild(piece);
    }
    container.appendChild(frag);

    setTimeout(() => container.remove(), 9800);
  }

  function initCelebrationScene() {
    ambientIntensity = 1;
    const slot = qs("#celebration-dog-slot");
    slot.innerHTML = "";
    const dog = createPrairieDogSVG({ withFlower: false });
    dog.classList.add("pd-sit", "pd-happy");
    slot.appendChild(dog);

    revealLines(qs("#scene-celebration"), { stagger: 1300, startDelay: 400 }).then(() => {
      spawnCelebrationBurst();
      playChime();
      setTimeout(() => goToScene("sky"), 5200);
    });
  }

  /* ---------------------------------------------------------
     17. ESCENA FINAL · CIELO Y CONSTELACIÓN
  --------------------------------------------------------- */
  function initSkyScene() {
    ambientIntensity = 0.8;
    revealLines(qs("#scene-sky"), { stagger: 1500, startDelay: 900 });
    startSkyCanvas();
  }

  function startSkyCanvas() {
    const canvas = qs("#sky-canvas");
    const ctx = canvas.getContext("2d");
    const SKY_MAX_DPR = perfTier === "mobile" ? 1 : 2;
    let { w, h } = sizeCanvas(canvas, ctx, SKY_MAX_DPR);

    const bgStars = Array.from({ length: perfTier === "mobile" ? 50 : 100 }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.5), phase: rand(0, Math.PI * 2),
    }));

    // puntos de la constelación formando una flor (centro + pétalos)
    const cx = w / 2, cy = h * 0.42;
    const R = Math.min(w, h) * 0.16;
    const petalPoints = 7;
    const points = [{ x: cx, y: cy }];
    for (let i = 0; i < petalPoints; i++) {
      const a = (Math.PI * 2 * i) / petalPoints - Math.PI / 2;
      points.push({
        x: cx + Math.cos(a) * R,
        y: cy + Math.sin(a) * R,
      });
    }

    const lines = points.slice(1).map((p, i) => [points[0], p]);
    let progress = 0;
    const totalDuration = reducedMotion ? 1 : 4200;
    const start = performance.now();
    let lastSkyFrame = 0;
    const SKY_FRAME_INTERVAL = perfTier === "mobile" ? 1000 / 30 : 0;

    function frame(now) {
      if (currentScene !== scenes.sky) return; // dejar de dibujar si ya no estamos en esta escena

      if (SKY_FRAME_INTERVAL && now - lastSkyFrame < SKY_FRAME_INTERVAL) {
        requestAnimationFrame(frame);
        return;
      }
      lastSkyFrame = now;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0A0907";
      ctx.fillRect(0, 0, w, h);

      bgStars.forEach((s) => {
        const tw = 0.5 + Math.sin(now * 0.0015 + s.phase) * 0.5;
        ctx.beginPath();
        ctx.fillStyle = `rgba(244,235,221,${0.15 + tw * 0.35})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      progress = reducedMotion ? 1 : clamp((now - start) / totalDuration, 0, 1);
      const linesToDraw = Math.ceil(progress * lines.length);

      ctx.strokeStyle = "rgba(244,211,94,.55)";
      ctx.lineWidth = 1;
      for (let i = 0; i < linesToDraw; i++) {
        const [a, b] = lines[i];
        const localP = clamp(progress * lines.length - i, 0, 1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * localP, a.y + (b.y - a.y) * localP);
        ctx.stroke();
      }

      points.forEach((p, i) => {
        const appear = i === 0 ? 1 : clamp(progress * lines.length - (i - 1), 0, 1);
        if (appear <= 0) return;
        ctx.beginPath();
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
        glow.addColorStop(0, `rgba(244,211,94,${0.9 * appear})`);
        glow.addColorStop(1, "rgba(244,211,94,0)");
        ctx.fillStyle = glow;
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,249,237,${appear})`;
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      if (progress < 1 || !reducedMotion) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.addEventListener("resize", () => {
      if (currentScene === scenes.sky) ({ w, h } = sizeCanvas(canvas, ctx, SKY_MAX_DPR));
    });
  }

  /* ---------------------------------------------------------
     18. ARRANQUE
  --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    goToScene("void", { instant: true });
  });
})();
