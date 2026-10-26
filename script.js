(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /*  Música: caja de música sintetizada con Web Audio                   */
  /* ------------------------------------------------------------------ */

  const Music = (() => {
    const MASTER = 0.34;
    const BEAT = 0.72;
    const LOOP = 16 * BEAT;
    const ARP = [
      [72, 0], [76, .5], [79, 1], [84, 1.5], [79, 2], [76, 2.5], [72, 3], [76, 3.5],
      [69, 4], [72, 4.5], [76, 5], [81, 5.5], [76, 6], [72, 6.5], [69, 7], [72, 7.5],
      [65, 8], [69, 8.5], [72, 9], [77, 9.5], [72, 10], [69, 10.5], [65, 11], [69, 11.5],
      [67, 12], [71, 12.5], [74, 13], [79, 13.5], [74, 14], [71, 14.5], [67, 15], [71, 15.5]
    ];
    const BASS = [[48, 0, 3.4], [45, 4, 3.4], [41, 8, 3.4], [43, 12, 3.4]];

    let ctx = null;
    let master = null;
    let delay = null;
    let started = false;
    let muted = false;
    let nextTime = 0;
    let timer = null;

    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.27;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(master);
      return true;
    }

    function voice(freq, when, dur, level) {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(level, when + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      const partials = [[1, 1], [2, 0.26], [3, 0.11], [4.01, 0.045]];
      for (const [mult, amp] of partials) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        const g = ctx.createGain();
        g.gain.value = amp;
        osc.connect(g);
        g.connect(env);
        osc.start(when);
        osc.stop(when + dur + 0.06);
      }
      env.connect(master);
      env.connect(delay);
    }

    function scheduleLoop() {
      if (!ctx) return;
      const t = nextTime;
      for (const [m, b] of ARP) voice(mtof(m), t + b * BEAT, 1.15 * BEAT, 0.33);
      for (const [m, b, d] of BASS) voice(mtof(m), t + b * BEAT, d * BEAT, 0.19);
      nextTime += LOOP;
    }

    function fadeTo(value, seconds = 1.2) {
      if (!master) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(value, now + seconds);
    }

    function start() {
      if (started) {
        if (ctx && ctx.state === "suspended") ctx.resume();
        return;
      }
      if (!ctx && !init()) return;
      if (ctx.state === "suspended") ctx.resume();
      started = true;
      nextTime = ctx.currentTime + 0.18;
      scheduleLoop();
      timer = window.setInterval(scheduleLoop, LOOP * 1000);
      fadeTo(muted ? 0 : MASTER, 1.6);
    }

    function setMuted(value) {
      muted = value;
      if (started) fadeTo(value ? 0 : MASTER, 0.5);
    }

    function chime() {
      if (!started || muted) return;
      const t = ctx.currentTime + 0.05;
      [84, 88, 91, 96].forEach((m, i) => {
        voice(mtof(m), t + i * 0.085, 1.1, 0.3);
      });
    }

    function handleVisibility() {
      if (!started) return;
      fadeTo(document.hidden || muted ? 0 : MASTER, 0.4);
    }

    return { start, setMuted, chime, handleVisibility };
  })();

  /* ------------------------------------------------------------------ */
  /*  Confeti                                                            */
  /* ------------------------------------------------------------------ */

  const Confetti = (() => {
    const canvas = $("#confetti");
    const c = canvas.getContext("2d");
    const colors = ["#f6b8cc", "#e2809f", "#cdbdf0", "#a992e0", "#e8c07a", "#bfe3d0", "#fff8f0", "#ffb7c9"];
    let W = 0, H = 0, dpr = 1;
    let parts = [];
    let raf = null;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function heartPath(size) {
      const k = size / 16;
      c.beginPath();
      c.moveTo(0, 4 * k);
      c.bezierCurveTo(0, 0, -8 * k, 0, -8 * k, 5 * k);
      c.bezierCurveTo(-8 * k, 10 * k, 0, 13 * k, 0, 16 * k);
      c.bezierCurveTo(0, 13 * k, 8 * k, 10 * k, 8 * k, 5 * k);
      c.bezierCurveTo(8 * k, 0, 0, 0, 0, 4 * k);
      c.closePath();
    }

    function makeParticle(x, y, vx, vy, gravity, lifeDecay) {
      return {
        x, y, vx, vy,
        g: gravity,
        size: 5 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() < 0.22 ? "heart" : (Math.random() < 0.5 ? "rect" : "circle"),
        life: 1,
        decay: lifeDecay,
        wob: Math.random() * Math.PI * 2
      };
    }

    function burst(x, y, count, power = 1) {
      const n = reduceMotion ? Math.ceil(count / 3) : count;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (2 + Math.random() * 7) * power;
        parts.push(makeParticle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 3 * power,
          0.11 + Math.random() * 0.06,
          0.006 + Math.random() * 0.006
        ));
      }
      run();
    }

    function rain() {
      const n = reduceMotion ? 25 : 90;
      for (let i = 0; i < n; i++) {
        parts.push(makeParticle(
          Math.random() * W,
          -20 - Math.random() * H * 0.6,
          (Math.random() - 0.5) * 1.4,
          1 + Math.random() * 2,
          0.02,
          0.0022 + Math.random() * 0.002
        ));
      }
      run();
    }

    function draw() {
      c.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += p.g;
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.wob += 0.08;
        p.life -= p.decay;

        if (p.life <= 0 || p.y > H + 60) {
          parts.splice(i, 1);
          continue;
        }

        c.save();
        c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.7));
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color;

        if (p.shape === "rect") {
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          c.beginPath();
          c.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
          c.fill();
        } else {
          heartPath(p.size);
          c.fill();
        }
        c.restore();
      }
    }

    function loop() {
      draw();
      if (parts.length) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
        c.clearRect(0, 0, W, H);
      }
    }

    function run() {
      if (!raf) raf = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", resize);
    resize();

    return { burst, rain };
  })();

  /* ------------------------------------------------------------------ */
  /*  Escenas                                                            */
  /* ------------------------------------------------------------------ */

  const scenes = {
    gift: $("#scene-gift"),
    cake: $("#scene-cake"),
    card: $("#scene-card")
  };
  const giftBtn = $("#gift-btn");
  const cake = $("#cake");
  const blowBtn = $("#blow-btn");
  const wishText = $("#wish-text");
  const againBtn = $("#again-btn");
  const soundBtn = $("#sound-btn");
  const candles = $$(".candle", cake);

  let current = "gift";

  function show(name, focus = true) {
    current = name;
    for (const [key, el] of Object.entries(scenes)) {
      const active = key === name;
      el.hidden = !active;
      el.classList.toggle("is-active", active);
    }
    if (focus) {
      const heading = scenes[name].querySelector("h1, h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Regalo                                                             */
  /* ------------------------------------------------------------------ */

  let opened = false;

  function openGift() {
    if (opened) return;
    opened = true;
    Music.start();
    giftBtn.classList.add("is-open");
    giftBtn.setAttribute("aria-disabled", "true");

    const r = giftBtn.getBoundingClientRect();
    Confetti.burst(r.left + r.width / 2, r.top + r.height * 0.42, 95, 1.15);

    window.setTimeout(() => show("cake"), 950);
  }

  giftBtn.addEventListener("click", openGift);

  /* ------------------------------------------------------------------ */
  /*  Velas: mantener pulsado para soplar                                */
  /* ------------------------------------------------------------------ */

  const HOLD_PER_CANDLE = 720;
  const TOTAL_HOLD = HOLD_PER_CANDLE * 3;

  let holdAccum = 0;
  let holdStart = null;
  let rafId = null;
  let extinguished = 0;
  let done = false;

  function tick() {
    const now = performance.now();
    const elapsed = holdAccum + (holdStart !== null ? now - holdStart : 0);
    const progress = Math.min(1, elapsed / TOTAL_HOLD);

    blowBtn.style.setProperty("--p", progress.toFixed(3));

    const target = Math.min(3, Math.floor(elapsed / HOLD_PER_CANDLE));
    while (extinguished < target) {
      const candle = candles[extinguished];
      if (candle) candle.classList.add("is-out");
      extinguished += 1;
    }

    if (elapsed >= TOTAL_HOLD) {
      finishBlow();
      return;
    }
    if (holdStart !== null) rafId = requestAnimationFrame(tick);
  }

  function beginBlow(event) {
    if (done) return;
    if (event && event.cancelable) event.preventDefault();
    if (holdStart !== null) return;
    holdStart = performance.now();
    cake.classList.add("is-blowing");
    tick();
  }

  function endBlow() {
    if (holdStart === null) return;
    holdAccum += performance.now() - holdStart;
    holdStart = null;
    cake.classList.remove("is-blowing");
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function finishBlow() {
    if (done) return;
    done = true;
    endBlow();
    extinguished = 3;
    candles.forEach((candle) => candle.classList.add("is-out"));
    cake.classList.add("is-dark");
    blowBtn.classList.add("is-done");
    blowBtn.style.setProperty("--p", "1");
    wishText.textContent = "Deseo concedido. Que se cumpla, de verdad.";
    Music.chime();
    Confetti.burst(window.innerWidth / 2, window.innerHeight * 0.44, 140, 1.35);

    window.setTimeout(() => {
      show("card");
      Confetti.rain();
    }, 1500);
  }

  blowBtn.addEventListener("pointerdown", (event) => {
    try { blowBtn.setPointerCapture(event.pointerId); } catch (_) { /* puntero sintético */ }
    beginBlow(event);
  });
  window.addEventListener("pointerup", endBlow);
  window.addEventListener("pointercancel", endBlow);
  window.addEventListener("blur", endBlow);

  cake.addEventListener("pointerdown", (event) => {
    if (!done) beginBlow(event);
  });

  blowBtn.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) beginBlow(event);
  });
  blowBtn.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    endBlow();
  });

  /* ------------------------------------------------------------------ */
  /*  Reinicio                                                           */
  /* ------------------------------------------------------------------ */

  function reset() {
    opened = false;
    done = false;
    extinguished = 0;
    holdAccum = 0;
    holdStart = null;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;

    giftBtn.classList.remove("is-open");
    giftBtn.removeAttribute("aria-disabled");
    cake.classList.remove("is-dark", "is-blowing");
    candles.forEach((candle) => candle.classList.remove("is-out"));
    blowBtn.classList.remove("is-done");
    blowBtn.style.setProperty("--p", "0");
    wishText.textContent = "";

    show("gift", false);
    giftBtn.focus({ preventScroll: true });
  }

  againBtn.addEventListener("click", reset);

  /* ------------------------------------------------------------------ */
  /*  Sonido                                                             */
  /* ------------------------------------------------------------------ */

  soundBtn.addEventListener("click", () => {
    const wasOn = soundBtn.getAttribute("aria-pressed") === "true";
    const nowOn = !wasOn;
    soundBtn.setAttribute("aria-pressed", String(nowOn));
    soundBtn.setAttribute("aria-label", nowOn ? "Silenciar la música" : "Activar la música");
    Music.setMuted(!nowOn);
    if (nowOn) Music.start();
  });

  document.addEventListener("visibilitychange", () => Music.handleVisibility());

  /* ------------------------------------------------------------------ */
  /*  Estado inicial (útil para capturas: ?escena=tarta / ?escena=tarjeta) */
  /* ------------------------------------------------------------------ */

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("escena");

  if (params.get("estatico") === "1") {
    document.documentElement.classList.add("no-anim");
  }

  if (requested === "tarta" || requested === "cake") {
    opened = true;
    giftBtn.classList.add("is-open");
    giftBtn.setAttribute("aria-disabled", "true");
    show("cake", false);
  } else if (requested === "tarjeta" || requested === "card") {
    opened = true;
    done = true;
    extinguished = 3;
    candles.forEach((candle) => candle.classList.add("is-out"));
    cake.classList.add("is-dark");
    blowBtn.classList.add("is-done");
    blowBtn.style.setProperty("--p", "1");
    show("card", false);
  }
})();
