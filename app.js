(() => {
  const STORAGE_KEY = "flip-clock-settings";
  const TOP_MS = 220;
  const BOTTOM_MS = 220;

  const appEl = document.getElementById("app");
  const clockEl = document.getElementById("clock");
  const ledEl = document.getElementById("led");
  const modernEl = document.getElementById("modern");
  const hintEl = document.getElementById("hint");
  const sheetEl = document.getElementById("sheet");
  const installNoteEl = document.getElementById("install-note");
  const fmt12 = document.getElementById("fmt-12");
  const fmt24 = document.getElementById("fmt-24");
  const styleFlip = document.getElementById("style-flip");
  const styleLed = document.getElementById("style-led");
  const styleModern = document.getElementById("style-modern");
  const secOff = document.getElementById("sec-off");
  const secOn = document.getElementById("sec-on");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const statusMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );

  const settings = loadSettings();
  const params = new URLSearchParams(location.search);
  if (params.get("seconds") === "1") settings.showSeconds = true;
  if (params.get("seconds") === "0") settings.showSeconds = false;
  if (params.get("h") === "24") settings.use24Hour = true;
  if (params.get("h") === "12") settings.use24Hour = false;
  if (params.get("hint") === "0") settings.seenHint = true;
  if (params.get("style") === "led") settings.style = "led";
  if (params.get("style") === "flip") settings.style = "flip";
  if (params.get("style") === "modern") settings.style = "modern";

  let mode = "clock";
  let stopwatchStartedAt = 0;

  function normalizeStyle(value) {
    if (value === "led" || value === "modern") return value;
    return "flip";
  }

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        use24Hour: Boolean(raw.use24Hour),
        showSeconds: Boolean(raw.showSeconds),
        seenHint: Boolean(raw.seenHint),
        style: normalizeStyle(raw.style),
      };
    } catch {
      return {
        use24Hour: false,
        showSeconds: false,
        seenHint: false,
        style: "flip",
      };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function isStandalone() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches
    );
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function timeParts(date) {
    let hour = date.getHours();
    const minute = pad2(date.getMinutes());
    const second = pad2(date.getSeconds());
    let period = "";

    if (settings.use24Hour) {
      hour = pad2(hour);
    } else {
      period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      hour = String(hour);
    }

    return { hour, minute, second, period };
  }

  function stopwatchParts() {
    const ms = Math.max(0, Date.now() - stopwatchStartedAt);
    const totalSec = Math.floor(ms / 1000);
    return {
      hour: pad2(Math.floor(totalSec / 60) % 100),
      minute: pad2(totalSec % 60),
      second: pad2(Math.floor((ms % 1000) / 10)),
      period: "",
    };
  }

  function displayParts() {
    return mode === "stopwatch" ? stopwatchParts() : timeParts(new Date());
  }

  function setStopwatchMode(on) {
    mode = on ? "stopwatch" : "clock";
    stopwatchStartedAt = on ? Date.now() : 0;
    clockEl.classList.toggle("is-stopwatch", on);
    ledEl.classList.toggle("is-stopwatch", on);
    modernEl.classList.toggle("is-stopwatch", on);
  }

  function makeUnit(kind) {
    const unit = document.createElement("div");
    unit.className = "unit";
    unit.dataset.kind = kind;
    unit.innerHTML = `
      <div class="face top"><span class="num"></span></div>
      <div class="face bottom"><span class="num"></span></div>
      <div class="flap top"><span class="num"></span></div>
      <div class="flap bottom"><span class="num"></span></div>
      <div class="hinge"></div>
      ${kind === "hour" ? '<div class="period"></div>' : ""}
    `;
    return {
      el: unit,
      kind,
      value: null,
      period: "",
      animating: false,
      pending: null,
      topFace: unit.querySelector(".face.top .num"),
      bottomFace: unit.querySelector(".face.bottom .num"),
      topFlap: unit.querySelector(".flap.top"),
      bottomFlap: unit.querySelector(".flap.bottom"),
      topFlapNum: unit.querySelector(".flap.top .num"),
      bottomFlapNum: unit.querySelector(".flap.bottom .num"),
      periodEl: unit.querySelector(".period"),
    };
  }

  const units = {
    hour: makeUnit("hour"),
    minute: makeUnit("minute"),
    second: makeUnit("second"),
  };

  clockEl.append(units.hour.el, units.minute.el, units.second.el);

  function makeLedGroup(kind) {
    const group = document.createElement("div");
    group.className = "led-group";
    group.dataset.kind = kind;
    const num = document.createElement("div");
    num.className = "led-num";
    group.append(num);
    return { el: group, num };
  }

  function makeLedColon() {
    const el = document.createElement("div");
    el.className = "led-colon";
    el.textContent = ":";
    return el;
  }

  const led = {
    hour: makeLedGroup("hour"),
    minute: makeLedGroup("minute"),
    second: makeLedGroup("second"),
    colonHM: makeLedColon(),
    colonMS: makeLedColon(),
    period: document.createElement("div"),
  };

  led.period.className = "led-period";
  led.hour.el.append(led.period);

  ledEl.append(
    led.hour.el,
    led.colonHM,
    led.minute.el,
    led.colonMS,
    led.second.el
  );

  function makeModernGroup(kind) {
    const group = document.createElement("div");
    group.className = "modern-group";
    group.dataset.kind = kind;
    const num = document.createElement("div");
    num.className = "modern-num";
    group.append(num);
    return { el: group, num };
  }

  function makeModernColon() {
    const el = document.createElement("div");
    el.className = "modern-colon";
    el.textContent = ":";
    return el;
  }

  const modern = {
    hour: makeModernGroup("hour"),
    minute: makeModernGroup("minute"),
    second: makeModernGroup("second"),
    colonHM: makeModernColon(),
    colonMS: makeModernColon(),
    period: document.createElement("div"),
  };

  modern.period.className = "modern-period";
  modern.hour.el.append(modern.period);

  modernEl.append(
    modern.hour.el,
    modern.colonHM,
    modern.minute.el,
    modern.colonMS,
    modern.second.el
  );

  function setNodeText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function renderLed(parts) {
    setNodeText(led.hour.num, String(parts.hour).padStart(2, "0"));
    setNodeText(led.minute.num, parts.minute);
    setNodeText(led.second.num, parts.second);
    setNodeText(led.period, parts.period || "");
  }

  function setModernDigits(node, value) {
    const text = String(value);
    if (node.dataset.value === text) return;
    node.dataset.value = text;
    node.replaceChildren(
      ...[...text].map((ch) => {
        const span = document.createElement("span");
        span.className = "modern-digit";
        span.textContent = ch;
        return span;
      })
    );
  }

  function renderModern(parts) {
    setModernDigits(modern.hour.num, parts.hour);
    setModernDigits(modern.minute.num, parts.minute);
    setModernDigits(modern.second.num, parts.second);
    setNodeText(modern.period, parts.period || "");
  }

  function slotLayout(el, options = {}) {
    const portrait = window.innerHeight >= window.innerWidth;
    const count = settings.showSeconds ? 3 : 2;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const shortest = Math.min(w, h);
    const padX = Math.max(18, w * (portrait ? 0.07 : 0.045));
    const padY = Math.max(18, h * (portrait ? 0.055 : 0.07));
    const gap = Math.max(8, shortest * 0.03 * (options.gapScale || 1));
    const extraW = options.extraW || 0;
    const availW = Math.max(0, w - padX * 2 - extraW);
    const availH = Math.max(0, h - padY * 2);

    let cardW;
    let cardH;
    if (portrait) {
      cardW = availW;
      cardH = (availH - gap * (count - 1)) / count;
      if (!options.fill) cardH = Math.min(cardH, cardW / 1.18);
    } else {
      cardW = (availW - gap * (count - 1)) / count;
      cardH = availH;
      if (!options.fill) cardW = Math.min(cardW, cardH * 0.92);
    }

    return {
      portrait,
      count,
      cardW: Math.round(cardW),
      cardH: Math.round(cardH),
      gap: Math.round(gap),
    };
  }

  function setCssVars(el, vars) {
    Object.entries(vars).forEach(([name, value]) => {
      if (el.style.getPropertyValue(name) !== value) {
        el.style.setProperty(name, value);
      }
    });
  }

  function layoutLed() {
    const portrait = window.innerHeight >= window.innerWidth;
    const colonCount = portrait ? 0 : settings.showSeconds ? 2 : 1;
    const colonW = portrait
      ? 0
      : Math.round(
          Math.max(22, Math.min(ledEl.clientWidth, ledEl.clientHeight) * 0.07)
        );
    const needPmRoom =
      portrait && !settings.use24Hour && mode !== "stopwatch";
    const { cardW, cardH, gap } = slotLayout(ledEl, {
      fill: true,
      extraW: colonW * colonCount,
      gapScale: needPmRoom ? 5 : 1,
    });
    const font = Math.round(Math.min(cardH * 0.96, cardW * 0.61));

    setCssVars(ledEl, {
      "--gap": `${gap}px`,
      "--card-w": `${cardW}px`,
      "--card-h": `${cardH}px`,
      "--led-font": `${font}px`,
      "--colon-w": `${colonW || Math.max(18, Math.round(cardW * 0.12))}px`,
      "--led-period": `${Math.max(11, Math.round(Math.min(cardH, cardW) * 0.1))}px`,
    });
    ledEl.classList.toggle("is-portrait", portrait);
    ledEl.classList.toggle("is-landscape", !portrait);
    ledEl.classList.toggle("fmt-24", settings.use24Hour);
    led.second.el.classList.toggle("is-hidden", !settings.showSeconds);
    led.colonMS.classList.toggle("is-hidden", !settings.showSeconds);
  }

  function layoutModern() {
    const portrait = window.innerHeight >= window.innerWidth;
    const colonCount = portrait ? 0 : settings.showSeconds ? 2 : 1;
    const colonW = portrait
      ? 0
      : Math.round(
          Math.max(16, Math.min(modernEl.clientWidth, modernEl.clientHeight) * 0.045)
        );
    const needPmRoom =
      portrait && !settings.use24Hour && mode !== "stopwatch";
    const { cardW, cardH, gap } = slotLayout(modernEl, {
      fill: true,
      extraW: colonW * colonCount,
      gapScale: needPmRoom ? 5 : 1,
    });
    const font = Math.round(Math.min(cardH * 0.84, cardW * 0.82));

    setCssVars(modernEl, {
      "--gap": `${gap}px`,
      "--card-w": `${cardW}px`,
      "--card-h": `${cardH}px`,
      "--modern-font": `${font}px`,
      "--colon-w": `${colonW || Math.max(14, Math.round(cardW * 0.1))}px`,
      "--modern-period": `${Math.max(12, Math.round(Math.min(cardH, cardW) * 0.11))}px`,
    });
    modernEl.classList.toggle("is-portrait", portrait);
    modernEl.classList.toggle("is-landscape", !portrait);
    modernEl.classList.toggle("fmt-24", settings.use24Hour);
    modern.second.el.classList.toggle("is-hidden", !settings.showSeconds);
    modern.colonMS.classList.toggle("is-hidden", !settings.showSeconds);
  }

  function applyStyle() {
    const style = normalizeStyle(settings.style);
    document.body.classList.toggle("is-led", style === "led");
    document.body.classList.toggle("is-flip", style === "flip");
    document.body.classList.toggle("is-modern", style === "modern");
    clockEl.classList.toggle("is-hidden", style !== "flip");
    ledEl.classList.toggle("is-hidden", style !== "led");
    modernEl.classList.toggle("is-hidden", style !== "modern");
    if (themeMeta) themeMeta.setAttribute("content", "#000000");
    if (statusMeta) statusMeta.setAttribute("content", "black");
  }

  function setTexts(unit, value, period) {
    unit.topFace.textContent = value;
    unit.bottomFace.textContent = value;
    unit.topFlapNum.textContent = value;
    unit.bottomFlapNum.textContent = value;
    if (unit.periodEl) unit.periodEl.textContent = period || "";
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function flipTo(unit, value, period) {
    unit.animating = true;

    const oldValue = unit.value;
    unit.topFace.textContent = value;
    unit.bottomFace.textContent = oldValue;
    unit.topFlapNum.textContent = oldValue;
    unit.bottomFlapNum.textContent = value;
    if (unit.periodEl) unit.periodEl.textContent = period || "";

    unit.el.classList.remove("bottom-in");
    void unit.el.offsetWidth;
    unit.el.classList.add("flipping");

    await wait(TOP_MS);

    unit.el.classList.add("bottom-in");
    await wait(BOTTOM_MS);

    unit.value = value;
    unit.period = period;
    setTexts(unit, value, period);
    unit.el.classList.remove("flipping", "bottom-in");
    unit.animating = false;

    if (unit.pending) {
      const next = unit.pending;
      unit.pending = null;
      if (next.value !== unit.value || next.period !== unit.period) {
        flipTo(unit, next.value, next.period);
      }
    }
  }

  function setUnit(unit, value, period, immediate) {
    if (unit.value === null || immediate) {
      unit.value = value;
      unit.period = period;
      setTexts(unit, value, period);
      return;
    }
    if (value === unit.value && period === unit.period) return;
    if (unit.animating) {
      unit.pending = { value, period };
      return;
    }
    flipTo(unit, value, period);
  }

  function layout() {
    if (settings.style === "led") {
      layoutLed();
      return;
    }
    if (settings.style === "modern") {
      layoutModern();
      return;
    }
    const { portrait, cardW, cardH, gap } = slotLayout(clockEl);
    const radius = Math.min(cardW, cardH) * 0.13;
    const font = Math.min(cardH * 0.94, cardW * 0.76);
    const period = Math.max(11, Math.min(cardH, cardW) * 0.1);
    const hinge = Math.max(2, Math.round(cardH * 0.012));

    setCssVars(clockEl, {
      "--gap": `${gap}px`,
      "--card-w": `${cardW}px`,
      "--card-h": `${cardH}px`,
      "--radius": `${Math.round(radius)}px`,
      "--font": `${Math.round(font)}px`,
      "--period": `${Math.round(period)}px`,
      "--hinge-h": `${hinge}px`,
    });
    clockEl.classList.toggle("is-portrait", portrait);
    clockEl.classList.toggle("is-landscape", !portrait);
    clockEl.classList.toggle("fmt-24", settings.use24Hour);
    units.second.el.classList.toggle("is-hidden", !settings.showSeconds);
  }

  function render(immediate) {
    applyStyle();
    if (immediate || (settings.style !== "led" && settings.style !== "modern")) {
      layout();
    }
    const parts = displayParts();
    if (settings.style === "led") {
      renderLed(parts);
      return;
    }
    if (settings.style === "modern") {
      renderModern(parts);
      return;
    }
    const running = mode === "stopwatch";
    setUnit(units.hour, parts.hour, running ? "" : parts.period, immediate);
    setUnit(units.minute, parts.minute, "", immediate);
    setUnit(units.second, parts.second, "", immediate || running);
  }

  function syncButtons() {
    fmt12.classList.toggle("selected", !settings.use24Hour);
    fmt24.classList.toggle("selected", settings.use24Hour);
    styleFlip.classList.toggle("selected", settings.style === "flip");
    styleLed.classList.toggle("selected", settings.style === "led");
    styleModern.classList.toggle("selected", settings.style === "modern");
    secOff.classList.toggle("selected", !settings.showSeconds);
    secOn.classList.toggle("selected", settings.showSeconds);
  }

  function openSheet() {
    sheetEl.hidden = false;
    installNoteEl.hidden = isStandalone();
    syncButtons();
  }

  function closeSheet() {
    sheetEl.hidden = true;
  }

  function showHint() {
    if (settings.seenHint) return;
    hintEl.classList.add("show");
    setTimeout(() => {
      hintEl.classList.remove("show");
      settings.seenHint = true;
      saveSettings();
    }, 3500);
  }

  let tickTimer = 0;

  function scheduleTick() {
    clearTimeout(tickTimer);
    const delay =
      mode === "stopwatch"
        ? settings.showSeconds
          ? 32
          : 50
        : 1000 - (Date.now() % 1000) + 8;
    tickTimer = setTimeout(() => {
      render(false);
      scheduleTick();
    }, delay);
  }

  let pressTimer = 0;
  let didLongPress = false;
  let startX = 0;
  let startY = 0;

  appEl.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    if (!sheetEl.hidden) return;
    didLongPress = false;
    startX = event.clientX;
    startY = event.clientY;
    pressTimer = window.setTimeout(() => {
      didLongPress = true;
      openSheet();
    }, 480);
  });

  function cancelPress() {
    clearTimeout(pressTimer);
  }

  appEl.addEventListener("pointerup", (event) => {
    cancelPress();
    if (!sheetEl.hidden) return;
    if (didLongPress) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) return;
    setStopwatchMode(mode !== "stopwatch");
    render(true);
    scheduleTick();
  });

  appEl.addEventListener("pointercancel", cancelPress);
  appEl.addEventListener("pointerleave", cancelPress);

  document.getElementById("sheet-backdrop").addEventListener("click", closeSheet);

  document.querySelectorAll("[data-format]").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.use24Hour = btn.dataset.format === "24";
      saveSettings();
      syncButtons();
      render(true);
    });
  });

  document.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.style = normalizeStyle(btn.dataset.style);
      saveSettings();
      syncButtons();
      closeSheet();
      render(true);
    });
  });

  document.querySelectorAll("[data-seconds]").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.showSeconds = btn.dataset.seconds === "1";
      saveSettings();
      syncButtons();
      render(true);
      scheduleTick();
    });
  });

  window.addEventListener("resize", () => render(true));
  window.addEventListener("orientationchange", () => {
    setTimeout(() => render(true), 80);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      render(true);
      scheduleTick();
      requestWakeLock();
    }
  });
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener(
    "touchmove",
    (event) => event.preventDefault(),
    { passive: false }
  );

  let wakeLock = null;
  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (params.get("sw") === "1") setStopwatchMode(true);

  render(true);
  scheduleTick();
  showHint();
  requestWakeLock();
  if (params.get("sheet") === "1") openSheet();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => render(true));
  }
})();
