// ============================================================
//  game.js  —  Egg Falling Game  (Screen 2)
// ============================================================

// ------ Constants -------------------------------------------
const EGG_COLORS  = ['#ff6eb4','#ffd94a','#5dde7a','#b06aff','#4fc3f7','#ff9f43','#ff4757','#26de81','#fd79a8','#fdcb6e'];
const EGG_ACCENTS = ['#fff','#ff9f43','#ffd94a','#fff','#ff6eb4','#fff','#ffd94a','#fff','#ffd94a','#e17055'];
const PATTERNS    = ['stripes','zigzag','dots'];
const SPAWN_RATE  = 600;     // ms between new eggs
const EGG_MIN_SPD = 2.8;
const EGG_MAX_SPD = 5.8;
const EGG_RADIUS  = 38;      // half-height (ry)

let canvas, ctx;
let eggs       = [];
let splats     = [];
let grassBlades = [];
let spawnTimer = null;
let gameActive = false;
let GROUND_Y   = 0;

// ------ Audio -----------------------------------------------
function playSound(src) {
  try {
    const a = new Audio(src);
    a.volume = 0.7;
    a.play().catch(() => {});
  } catch(e) {}
}

// ------ Pre-bake grass so it never vibrates -----------------
function buildGrass() {
  grassBlades = [];
  for (let x = 0; x < canvas.width; x += 9) {
    grassBlades.push({
      x,
      h  : 6 + Math.sin(x * 0.3) * 4 + Math.random() * 3,
      gY : GROUND_Y - 4 + Math.sin(x * 0.05) * 6,
      cx : x + 3,
    });
  }
}

// ------ Draw sky + ground (static per frame) ----------------
function drawScene() {
  const W = canvas.width, H = canvas.height;

  // sky
  ctx.fillStyle = '#5ee7e7';
  ctx.fillRect(0, 0, W, H);

  // back hill
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y - 18);
  ctx.bezierCurveTo(W*0.15, GROUND_Y-48, W*0.35, GROUND_Y-10, W*0.55, GROUND_Y-32);
  ctx.bezierCurveTo(W*0.72, GROUND_Y-52, W*0.88, GROUND_Y-22, W, GROUND_Y-14);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = '#3db86e';
  ctx.fill();

  // front ground
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.bezierCurveTo(W*0.2, GROUND_Y-16, W*0.4, GROUND_Y+10, W*0.6, GROUND_Y-8);
  ctx.bezierCurveTo(W*0.78, GROUND_Y-20, W*0.9, GROUND_Y+6, W, GROUND_Y-4);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = '#27ae60';
  ctx.fill();

  // static grass blades — pre-baked, no random here
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth   = 2;
  grassBlades.forEach(b => {
    ctx.beginPath();
    ctx.moveTo(b.x, b.gY);
    ctx.quadraticCurveTo(b.cx, b.gY - b.h, b.x + 5, b.gY - b.h * 1.4);
    ctx.stroke();
  });
}

// ------ Egg object ------------------------------------------
function createEgg(startY) {
  const ci = Math.floor(Math.random() * EGG_COLORS.length);
  const sc = 0.8 + Math.random() * 0.5;
  return {
    x      : 40 + Math.random() * (canvas.width - 80),
    y      : startY !== undefined ? startY : -(EGG_RADIUS * sc + Math.random() * 60),
    vy     : EGG_MIN_SPD + Math.random() * (EGG_MAX_SPD - EGG_MIN_SPD),
    color  : EGG_COLORS[ci],
    accent : EGG_ACCENTS[ci],
    pattern: PATTERNS[Math.floor(Math.random() * 3)],
    scale  : sc,
    wobble : Math.random() * Math.PI * 2,
    alive  : true,
    popping: false,
    popR   : 0,
  };
}

// ------ Draw a pretty egg -----------------------------------
function drawEgg(e) {
  const rx = 28 * e.scale;
  const ry = EGG_RADIUS * e.scale * 0.85;
  const sx = Math.sin(e.wobble) * 5;

  ctx.save();
  ctx.translate(e.x + sx, e.y);

  // shadow
  ctx.beginPath();
  ctx.ellipse(3, 5, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = e.color;
  ctx.fill();

  // pattern — clipped inside egg
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.55;

  if (e.pattern === 'stripes') {
    ctx.strokeStyle = e.accent;
    ctx.lineWidth   = 3.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-rx * 1.5, i * ry * 0.38);
      ctx.lineTo( rx * 1.5, i * ry * 0.38);
      ctx.stroke();
    }
  } else if (e.pattern === 'zigzag') {
    ctx.strokeStyle = e.accent;
    ctx.lineWidth   = 2.5;
    for (let row = -2; row <= 2; row++) {
      const yb = row * ry * 0.42;
      ctx.beginPath();
      let first = true;
      for (let xi = -rx * 1.2; xi <= rx * 1.2; xi += rx * 0.35) {
        const yy = yb + (Math.round((xi + rx * 1.2) / (rx * 0.35)) % 2 === 0 ? -7 * e.scale : 7 * e.scale);
        first ? ctx.moveTo(xi, yy) : ctx.lineTo(xi, yy);
        first = false;
      }
      ctx.stroke();
    }
  } else {
    // dots
    ctx.fillStyle = e.accent;
    const sp = rx * 0.55;
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const ox = col * sp + (row % 2 === 0 ? 0 : sp * 0.5);
        const oy = row * sp * 0.85;
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5 * e.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore(); // end clip

  ctx.globalAlpha = 1;

  // outline
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // large shine
  ctx.beginPath();
  ctx.ellipse(-rx * 0.27, -ry * 0.3, rx * 0.2, ry * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();

  // small shine
  ctx.beginPath();
  ctx.ellipse(-rx * 0.1, -ry * 0.47, rx * 0.08, ry * 0.06, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  ctx.restore();
}

// ------ Draw mid-air pop burst ------------------------------
function drawPop(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = Math.max(0, 1 - e.popR / 80);

  ctx.beginPath();
  ctx.arc(0, 0, e.popR, 0, Math.PI * 2);
  ctx.strokeStyle = e.color;
  ctx.lineWidth   = 5;
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * e.popR * 0.8, Math.sin(a) * e.popR * 0.8, 5, 0, Math.PI * 2);
    ctx.fillStyle = EGG_COLORS[i % EGG_COLORS.length];
    ctx.fill();
  }

  ctx.restore();
}

// ------ Splat object (pre-baked, no random in draw) ---------
function createSplat(x, color) {
  // yolk blob points
  const blobPts = [];
  const arms    = 9 + Math.floor(Math.random() * 5);
  for (let i = 0; i < arms; i++) {
    blobPts.push({ a: (i / arms) * Math.PI * 2, r: 12 + Math.random() * 20 });
  }

  // drip drops
  const drops = [];
  blobPts.forEach((p, i) => {
    if (i % 2 === 0) {
      drops.push({
        dx: Math.cos(p.a) * p.r * 1.4,
        dy: Math.sin(p.a) * p.r * 0.45,
        r : 2 + Math.random() * 4,
      });
    }
  });

  // shell shards — white/cream jagged triangles with egg color border
  const shells     = [];
  const shardCount = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < shardCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 22 + Math.random() * 30;
    const size  = 6 + Math.random() * 10;
    const rot   = Math.random() * Math.PI;
    const pts   = [];
    for (let v = 0; v < 3; v++) {
      const va = rot + (v / 3) * Math.PI * 2;
      const vr = size * (0.6 + Math.random() * 0.8);
      pts.push({ x: Math.cos(va) * vr, y: Math.sin(va) * vr * 0.5 });
    }
    shells.push({
      cx: Math.cos(angle) * dist,
      cy: Math.sin(angle) * dist * 0.4,
      pts,
      color,
    });
  }

  return {
    x, y: GROUND_Y, color,
    blobPts, drops, shells,
    alpha: 1,
    born : performance.now(),
  };
}

// ------ Draw splat ------------------------------------------
function drawSplat(s) {
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.translate(s.x, s.y);

  // yolk blob
  ctx.beginPath();
  s.blobPts.forEach((p, i) => {
    const px = Math.cos(p.a) * p.r;
    const py = Math.sin(p.a) * p.r * 0.38;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = s.color;
  ctx.fill();

  // white centre
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // drip drops
  s.drops.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.dx, d.dy, d.r, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
  });

  // shell shards
  s.shells.forEach(sh => {
    ctx.save();
    ctx.translate(sh.cx, sh.cy);
    ctx.beginPath();
    sh.pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle   = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = sh.color;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    // crack line inside shard
    ctx.beginPath();
    ctx.moveTo(sh.pts[0].x * 0.4, sh.pts[0].y * 0.4);
    ctx.lineTo(sh.pts[1].x * 0.4, sh.pts[1].y * 0.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();
  });

  ctx.restore();
}

// ------ DOM confetti burst (tap) ----------------------------
function spawnConfetti(cx, cy) {
  const container = document.getElementById('burst-container');
  if (!container) return;
  for (let i = 0; i < 26; i++) {
    const dot   = document.createElement('div');
    dot.className = 'confetti-dot';
    const angle = Math.random() * 360;
    const dist  = 60 + Math.random() * 120;
    dot.style.cssText = `
      left: ${cx}px; top: ${cy}px;
      background: ${EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)]};
      --dx: ${Math.cos(angle * Math.PI / 180) * dist}px;
      --dy: ${Math.sin(angle * Math.PI / 180) * dist}px;
    `;
    container.appendChild(dot);
    setTimeout(() => dot.remove(), 900);
  }
}

// ------ Tap detection ---------------------------------------
function handleTap(clientX, clientY) {
  if (!gameActive) return;

  const rect = canvas.getBoundingClientRect();
  const tapX = clientX - rect.left;
  const tapY = clientY - rect.top;

  for (let i = eggs.length - 1; i >= 0; i--) {
    const e  = eggs[i];
    if (e.popping) continue;

    const rx = 28 * e.scale;
    const ry = EGG_RADIUS * e.scale * 0.85;
    const dx = tapX - e.x;
    const dy = tapY - e.y;

    if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
      e.alive   = false;
      e.popping = true;
      e.popR    = 0;

      playSound('assets/crack.mp3');
      spawnConfetti(tapX, tapY);

      gameActive = false;
      clearInterval(spawnTimer);

      setTimeout(() => {
        showScreen(3);
        startLoading();
      }, 700);

      return;
    }
  }
}

// ------ Main game loop --------------------------------------
function gameLoop() {
  if (!gameActive && eggs.every(e => !e.popping)) return;

  drawScene();

  // splats first (under eggs)
  const now = performance.now();
  splats = splats.filter(s => {
    const age = now - s.born;
    s.alpha   = Math.max(0, 1 - (age - 1400) / 1200);
    drawSplat(s);
    return s.alpha > 0;
  });

  // eggs
  eggs = eggs.filter(e => {
    if (e.popping) {
      e.popR += 5;
      drawPop(e);
      return e.popR < 80;
    }

    e.y      += e.vy;
    e.wobble += 0.05;

    const ry = EGG_RADIUS * e.scale * 0.85;

    // hit ground → splat
    if (e.y + ry >= GROUND_Y) {
      playSound('assets/splat.mp3');
      splats.push(createSplat(e.x, e.color));
      return false;
    }

    drawEgg(e);
    return e.alive;
  });

  requestAnimationFrame(gameLoop);
}

// ------ Init ------------------------------------------------
function initGame() {
  canvas     = document.getElementById('egg-canvas');
  ctx        = canvas.getContext('2d');
  eggs       = [];
  splats     = [];
  gameActive = true;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    GROUND_Y      = canvas.height - 72;
    buildGrass();
  }
  resize();
  window.addEventListener('resize', resize);

  // event listeners inside initGame so canvas is guaranteed to exist
  canvas.addEventListener('click', e => handleTap(e.clientX, e.clientY));
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
  }, { passive: false });

  // pre-fill top border with eggs
  for (let i = 0; i < 18; i++) {
    const e = createEgg();
    e.y     = -10 + Math.random() * 70;
    eggs.push(e);
  }

  // keep spawning
  spawnTimer = setInterval(() => {
    if (gameActive) eggs.push(createEgg());
  }, SPAWN_RATE);

  gameLoop();
}