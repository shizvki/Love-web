// ===== requestAnimationFrame polyfill =====
window.requestAnimationFrame =
  window.__requestAnimationFrame ||
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  (function () {
    return function (callback, element) {
      let lastTime = element.__lastTime;
      if (lastTime === undefined) lastTime = 0;
      const currTime = Date.now();
      const timeToCall = Math.max(1, 33 - (currTime - lastTime));
      window.setTimeout(callback, timeToCall);
      element.__lastTime = currTime + timeToCall;
    };
  })();

window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
  ((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()
));

let loaded = false;

function init() {
  if (loaded) return;
  loaded = true;

  const mobile = window.isDevice;
  const koef = mobile ? 0.5 : 1;

  // ✅ overlay дээр хэмжээгээ барина
  const overlay = document.getElementById('introOverlay');
  const canvas = document.getElementById('heart');
  const ctx = canvas.getContext('2d');

  let width = 0, height = 0;
  const rand = Math.random;

  const traceCount = mobile ? 20 : 50;
  const pointsOrigin = [];
  let heartPointsCount = 0;
  const targetPoints = [];

  let i, k;
  const dr = mobile ? 0.3 : 0.1;

  const heartPosition = function (rad) {
    return [
      Math.pow(Math.sin(rad), 3),
      -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad))
    ];
  };

  const scaleAndTranslate = function (pos, sx, sy, dx, dy) {
    return [dx + pos[0] * sx, dy + pos[1] * sy];
  };

  // ✅ дэлгэцэнд багтаах dynamic scale
  function buildPointsOrigin() {
    pointsOrigin.length = 0;

    const base = Math.min(width, height);

    // Эдгээр коэффициентүүд зүрхийг ихэнх дэлгэцэнд багтаадаг "safe" утгууд
    const sx1 = base * 0.22;
    const sy1 = base * 0.013;

    const sx2 = base * 0.16;
    const sy2 = base * 0.009;

    const sx3 = base * 0.10;
    const sy3 = base * 0.005;

    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), sx1, sy1, 0, 0));
    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), sx2, sy2, 0, 0));
    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), sx3, sy3, 0, 0));

    heartPointsCount = pointsOrigin.length;
    targetPoints.length = heartPointsCount;
  }

  function resize() {
    const rect = overlay.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // canvas internal resolution
    canvas.width = Math.floor(rect.width * koef * dpr);
    canvas.height = Math.floor(rect.height * koef * dpr);

    // scale for crispness
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    width = rect.width * koef;
    height = rect.height * koef;

    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, width, height);

    buildPointsOrigin();
  }

  resize();
  window.addEventListener('resize', resize);

  const pulse = function (kx, ky) {
    for (i = 0; i < heartPointsCount; i++) {
      const p = pointsOrigin[i];
      targetPoints[i] = targetPoints[i] || [0, 0];
      targetPoints[i][0] = kx * p[0] + width / 2;
      targetPoints[i][1] = ky * p[1] + height / 2;
    }
  };

  // particles
  const e = [];
  for (i = 0; i < heartPointsCount; i++) {
    const x = rand() * width;
    const y = rand() * height;
    e[i] = {
      vx: 0,
      vy: 0,
      speed: rand() + 5,
      q: ~~(rand() * heartPointsCount),
      D: 2 * (i % 2) - 1,
      force: 0.2 * rand() + 0.7,
      f: "hsla(0," + ~~(40 * rand() + 60) + "%," + ~~(60 * rand() + 20) + "%,.3)",
      trace: []
    };
    for (k = 0; k < traceCount; k++) e[i].trace[k] = { x, y };
  }

  const config = { traceK: 0.4, timeDelta: 0.01 };
  let time = 0;

  function loop() {
    const n = -Math.cos(time);
    pulse((1 + n) * 0.5, (1 + n) * 0.5);

    time += ((Math.sin(time)) < 0 ? 9 : (n > 0.8) ? 0.2 : 1) * config.timeDelta;

    ctx.fillStyle = "rgba(0,0,0,.1)";
    ctx.fillRect(0, 0, width, height);

    for (i = e.length; i--;) {
      const u = e[i];
      const q = targetPoints[u.q];
      const dx = u.trace[0].x - q[0];
      const dy = u.trace[0].y - q[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      if (len < 10) {
        if (rand() > 0.95) {
          u.q = ~~(rand() * heartPointsCount);
        } else {
          if (rand() > 0.99) u.D *= -1;
          u.q = (u.q + u.D) % heartPointsCount;
          if (u.q < 0) u.q += heartPointsCount;
        }
      }

      u.vx += (-dx / len) * u.speed;
      u.vy += (-dy / len) * u.speed;

      u.trace[0].x += u.vx;
      u.trace[0].y += u.vy;

      u.vx *= u.force;
      u.vy *= u.force;

      for (k = 0; k < u.trace.length - 1;) {
        const T = u.trace[k];
        const N = u.trace[++k];
        N.x -= config.traceK * (N.x - T.x);
        N.y -= config.traceK * (N.y - T.y);
      }

      ctx.fillStyle = u.f;
      for (k = 0; k < u.trace.length; k++) {
        ctx.fillRect(u.trace[k].x, u.trace[k].y, 1, 1);
      }
    }

    // жижиг white guide dots (хүсвэл авч болно)
    ctx.fillStyle = "rgba(255,255,255,1)";
    for (i = Math.min(heartPointsCount - 1, 60); i--;) {
      ctx.fillRect(targetPoints[i][0], targetPoints[i][1], 2, 2);
    }

    window.requestAnimationFrame(loop);
  }

  loop();
}

// DOM ready
const s = document.readyState;
if (s === 'complete' || s === 'loaded' || s === 'interactive') init();
else document.addEventListener('DOMContentLoaded', init, false);

// ===== Intro → Main transition =====
function finishIntro(){
  const intro = document.getElementById("introOverlay");
  const site  = document.getElementById("site");

  if (!intro || !site) return;

  intro.classList.add("hide");

  // CSS чинь site--hidden / site--show гэж байгаа
  site.classList.remove("site--hidden");
  site.classList.add("site--show");

  document.body.classList.remove("no-scroll");

  setTimeout(() => {
    intro.style.display = "none";
  }, 1000);
}

setTimeout(finishIntro, 3500);

const skip = document.getElementById("skipIntro");
if (skip) skip.addEventListener("click", finishIntro);

const overlay = document.getElementById("introOverlay");
if (overlay) overlay.addEventListener("click", (e) => {
  if (e.target && e.target.id === "skipIntro") return;
  finishIntro();
});
