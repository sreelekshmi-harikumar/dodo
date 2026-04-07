// ============================================================
//  game.js  —  Egg Falling Game (Cinematic Slow-Cracking Final)
//  Sync: 800ms Slow Creeping Crack -> Ramping Jitter -> Ribbon Boom
// ============================================================

// ------ Constants -------------------------------------------
const EGG_COLORS  = ['#ff6eb4','#ffd94a','#5dde7a','#b06aff','#4fc3f7','#ff9f43','#ff4757','#26de81','#fd79a8','#fdcb6e'];
const EGG_ACCENTS = ['#fff','#ff9f43','#ffd94a','#fff','#ff6eb4','#fff','#ffd94a','#fff','#ffd94a','#e17055'];
const PATTERNS    = ['stripes','zigzag','dots','diamonds'];
const SPAWN_RATE  = 600;
const EGG_MIN_SPD = 3.2;
const EGG_MAX_SPD = 6.4;
const ZOOM_SPEED  = 0.12; 

let canvas, ctx;
let eggs       = [];
let splats     = [];
let clouds     = [];
let grassTufts = [];
let spawnTimer = null;
let gameActive = false;
let GROUND_Y   = 0;
let focusedEgg = null; 

// ------ Audio — Preloaded -----------------------------------
const SOUNDS = {};

function preloadSounds() {
  ['crack', 'splat', 'pop'].forEach(name => {
    const a = new Audio(`assets/${name}.mp3`);
    a.load();
    SOUNDS[name] = a;
  });
}

function playSound(name) {
  try {
    const s = SOUNDS[name];
    if (!s) return;
    s.currentTime = 0; 
    s.volume = 0.7;
    s.play().catch(() => {});
  } catch(e) {}
}

// ------ Environment -----------------------------------------
function buildClouds() {
  clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 28 + Math.random() * 70,
      r: 26 + Math.random() * 26,
      speed: 0.15 + Math.random() * 0.15,
      alpha: 0.8 + Math.random() * 0.15,
    });
  }
}

function drawClouds() {
  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x - c.r * 2 > canvas.width) c.x = -c.r * 2;
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.arc(c.x+c.r*0.9, c.y+6, c.r*0.72, 0, Math.PI*2);
    ctx.arc(c.x-c.r*0.85, c.y+8, c.r*0.65, 0, Math.PI*2);
    ctx.arc(c.x+c.r*0.3, c.y-c.r*0.55, c.r*0.6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSun() {
  const sx = canvas.width - 65, sy = 52, sr = 28;
  ctx.save();
  const g = ctx.createRadialGradient(sx, sy, sr*0.4, sx, sy, sr*2.4);
  g.addColorStop(0, 'rgba(255,235,80,0.4)');
  g.addColorStop(1, 'rgba(255,235,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(sx, sy, sr*2.4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFD93D';
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFC300';
  ctx.beginPath(); ctx.arc(sx, sy, sr*0.7, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function buildGrass() {
  grassTufts = [];
  const rows = [
    { yOffset:-6, count:6, hMin:18, hMax:30, leanMax:0.22, thick:1.2, dark:'#2E7D32', light:'#4CAF50', spacing:9  },
    { yOffset:-2, count:7, hMin:14, hMax:24, leanMax:0.18, thick:1.5, dark:'#388E3C', light:'#66BB6A', spacing:8  },
    { yOffset: 2, count:8, hMin:10, hMax:18, leanMax:0.12, thick:1.8, dark:'#43A047', light:'#81C784', spacing:7  },
  ];
  rows.forEach(row => {
    for (let x = 0; x < canvas.width; x += row.spacing) {
      const baseY = GROUND_Y + row.yOffset + Math.sin(x * 0.05) * 3;
      const blades = [];
      for (let b = 0; b < row.count; b++) {
        const bx   = x + (b - row.count/2) * 3.5 + Math.random() * 3;
        const bh   = row.hMin + Math.random() * (row.hMax - row.hMin);
        const lean = (Math.random() - 0.5) * row.leanMax;
        blades.push({ bx, bh, lean, thick: row.thick + Math.random() * 0.6 });
      }
      grassTufts.push({ baseY, blades, dark: row.dark, light: row.light });
    }
  });
}

function drawGrass() {
  grassTufts.forEach(t => {
    t.blades.forEach(b => {
      ctx.strokeStyle = t.dark;
      ctx.lineWidth   = b.thick;
      ctx.beginPath();
      ctx.moveTo(b.bx, t.baseY);
      ctx.quadraticCurveTo(b.bx + b.lean*b.bh*0.6, t.baseY - b.bh*0.55, b.bx + b.lean*b.bh*1.1, t.baseY - b.bh);
      ctx.stroke();
      ctx.strokeStyle = t.light;
      ctx.lineWidth   = b.thick * 0.35;
      ctx.beginPath();
      ctx.moveTo(b.bx + 0.7, t.baseY);
      ctx.quadraticCurveTo(b.bx + b.lean*b.bh*0.6 + 0.7, t.baseY - b.bh*0.55, b.bx + b.lean*b.bh*1.1 + 0.7, t.baseY - b.bh);
      ctx.stroke();
    });
  });
}

function drawScene() {
  const W = canvas.width, H = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#87CEEB'); sky.addColorStop(1, '#C9EFFF');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawSun();
  drawClouds();
  
  // Rolling Hills
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y+5);
  ctx.bezierCurveTo(W*0.12,GROUND_Y-22, W*0.28,GROUND_Y-28, W*0.42,GROUND_Y-18);
  ctx.bezierCurveTo(W*0.56,GROUND_Y-8,  W*0.70,GROUND_Y-30, W*0.85,GROUND_Y-24);
  ctx.bezierCurveTo(W*0.93,GROUND_Y-18, W, GROUND_Y-10, W, GROUND_Y+5);
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fillStyle = '#4CAF50'; ctx.fill();

  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  drawGrass();
}

// ------ Egg Logic -------------------------------------------
function createEgg(startY, slow) {
  const ci = Math.floor(Math.random() * EGG_COLORS.length);
  const sc = 0.85 + Math.random() * 0.5;
  return {
    x       : 45 + Math.random() * (canvas.width - 90),
    y       : startY !== undefined ? startY : -(36*sc + Math.random()*80),
    vy      : slow ? 0.8 + Math.random()*1.5 : EGG_MIN_SPD + Math.random()*(EGG_MAX_SPD-EGG_MIN_SPD),
    vx      : (Math.random() - 0.5) * 0.5,
    color   : EGG_COLORS[ci],
    accent  : EGG_ACCENTS[ci],
    pattern : PATTERNS[Math.floor(Math.random() * 4)],
    scale   : sc,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    alive   : true,
    popping : false,
    cracked : false,
    crackProgress: 0,
    popR    : 0,
    popAlpha: 1,
    acc     : 0.045,
  };
}

function drawEgg(e) {
  const rx = 26 * e.scale, ry = 36 * e.scale;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rotation);

  // Shell Visuals
  ctx.shadowColor = e.color; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle = e.color; ctx.fill();

  // Pattern
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2); ctx.clip();
  ctx.globalAlpha = 0.52;
  if (e.pattern === 'stripes') {
    ctx.strokeStyle = e.accent; ctx.lineWidth = 3.5;
    for (let i=-3; i<=3; i++) { ctx.beginPath(); ctx.moveTo(-rx*1.5, i*ry*0.38); ctx.lineTo( rx*1.5, i*ry*0.38); ctx.stroke(); }
  } else if (e.pattern === 'zigzag') {
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2.5;
    for (let row=-2; row<=2; row++) {
      const yb = row*ry*0.42; ctx.beginPath(); let first=true;
      for (let xi=-rx*1.2; xi<=rx*1.2; xi+=rx*0.35) {
        const yy = yb + (Math.round((xi+rx*1.2)/(rx*0.35))%2===0 ? -7*e.scale : 7*e.scale);
        first ? ctx.moveTo(xi,yy) : ctx.lineTo(xi,yy); first=false;
      }
      ctx.stroke();
    }
  } else if (e.pattern === 'dots') {
    ctx.fillStyle = e.accent; const sp = rx*0.52;
    for (let row=-2; row<=2; row++) for (let col=-2; col<=2; col++) {
      ctx.beginPath(); ctx.arc(col*sp+(row%2===0?0:sp*0.5), row*sp*0.85, 3.5*e.scale, 0, Math.PI*2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2; const sp2 = rx*0.6;
    for (let row=-2; row<=2; row++) for (let col=-2; col<=2; col++) {
      const ox=col*sp2+(row%2===0?0:sp2*0.5), oy=row*sp2*0.75;
      ctx.beginPath(); ctx.moveTo(ox, oy-7*e.scale); ctx.lineTo(ox+6*e.scale, oy); ctx.lineTo(ox, oy+7*e.scale); ctx.lineTo(ox-6*e.scale, oy); ctx.closePath(); ctx.stroke();
    }
  }
  ctx.restore();

  // Gloss
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.ellipse(-rx*0.27,-ry*0.3,rx*0.22,ry*0.15,-0.4,0,Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();

  // --- CINEMATIC SLOW-CREEP RADIAL CRACKS ---
  if (e.cracked && e.crackProgress > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(35, 15, 0, ${0.4 + e.crackProgress * 0.6})`;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    const numMainCracks = 4; 
    for (let i = 0; i < numMainCracks; i++) {
      ctx.beginPath();
      ctx.lineWidth = (4 - i) * e.scale * e.crackProgress;
      ctx.moveTo(0, 0); 
      
      let curX = 0, curY = 0;
      const angle = (i * (Math.PI * 2) / numMainCracks) + 0.8;
      
      // Multi-segment creeping effect
      const totalSegments = 8;
      const segmentLength = (rx * 1.1 / totalSegments) * e.crackProgress; 
      
      for (let j = 0; j < totalSegments; j++) {
        curX += Math.cos(angle) * segmentLength + (Math.random() - 0.5) * 7;
        curY += Math.sin(angle) * segmentLength + (Math.random() - 0.5) * 7;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
    }
    
    // Core white break-point
    ctx.globalAlpha = e.crackProgress;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0,0, 3 * e.crackProgress, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPop(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  e.popAlpha = Math.max(0, 1 - e.popR/100);
  ctx.globalAlpha = e.popAlpha;
  for (let ring=0; ring<3; ring++) {
    const r = e.popR * (0.5 + ring*0.28);
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle = EGG_COLORS[(EGG_COLORS.indexOf(e.color)+ring) % EGG_COLORS.length];
    ctx.lineWidth = 5-ring; ctx.stroke();
  }
  ctx.restore();
}

// ------ Effects ---------------------------------------------
function createSplat(x, color) {
  const blobPts = [], arms = 10 + Math.floor(Math.random()*5);
  for (let i=0; i<arms; i++) blobPts.push({ a:(i/arms)*Math.PI*2, r:10+Math.random()*14 });
  const whitePts = [], wArms = 12 + Math.floor(Math.random()*5);
  for (let i=0; i<wArms; i++) whitePts.push({ a:(i/wArms)*Math.PI*2, r:20+Math.random()*22 });
  return { x, y: GROUND_Y, color, blobPts, whitePts, alpha:1, born:performance.now() };
}

function drawSplat(s) {
  ctx.save(); ctx.globalAlpha = s.alpha; ctx.translate(s.x, s.y);
  ctx.scale(1, 0.38);
  ctx.beginPath();
  s.whitePts.forEach((p,i) => {
    const px=Math.cos(p.a)*p.r, py=Math.sin(p.a)*p.r;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fill();
  ctx.beginPath();
  s.blobPts.forEach((p,i) => {
    const px=Math.cos(p.a)*p.r, py=Math.sin(p.a)*p.r;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  });
  ctx.fillStyle=s.color; ctx.fill();
  ctx.restore();
}

function spawnConfetti(tapX, tapY) {
  const container = document.getElementById('burst-container');
  if (!container) return;

  // Surprise text
  const msg = document.createElement('div');
  msg.className = 'surprise-text';
  msg.textContent = '🎁 You found the surprise gift!';
  container.appendChild(msg);
  setTimeout(() => msg.remove(), 3500);

  // Small rectangular confetti bits
  for (let i = 0; i < 90; i++) {
    const bit = document.createElement('div');
    bit.className = 'confetti-dot';
    const a = Math.random() * 360;
    const dist = 120 + Math.random() * 420;
    const w = 5 + Math.random() * 7;
    const h = Math.random() > 0.5 ? w * 0.5 : w * (1.5 + Math.random() * 2);
    const color = EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
    const delay = Math.random() * 150;
    bit.style.cssText = `
      left:${tapX}px; top:${tapY}px;
      width:${w}px; height:${h}px;
      background:${color};
      position:absolute;
      border-radius:1px;
      --dx:${Math.cos(a * Math.PI / 180) * dist}px;
      --dy:${Math.sin(a * Math.PI / 180) * dist + 380}px;
      --rot:${Math.random() * 900}deg;
      animation: confettiBit 1.9s cubic-bezier(0.15,0.5,0.4,1) ${delay}ms forwards;
    `;
    container.appendChild(bit);
    setTimeout(() => bit.remove(), 2200);
  }

  // Curly spiral ribbons (SVG-based)
  for (let i = 0; i < 18; i++) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const color = EGG_COLORS[Math.floor(Math.random() * EGG_COLORS.length)];
    const size = 36 + Math.random() * 40;
    const a = Math.random() * 360;
    const dist = 160 + Math.random() * 480;
    const delay = Math.random() * 200;
    const dx = Math.cos(a * Math.PI / 180) * dist;
    const dy = Math.sin(a * Math.PI / 180) * dist + 300;
    const rot = Math.random() * 1080 - 540;
    const curlType = Math.floor(Math.random() * 3);

    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.cssText = `
      position:absolute;
      left:${tapX}px; top:${tapY}px;
      pointer-events:none;
      z-index:55;
      overflow:visible;
      --dx:${dx}px; --dy:${dy}px; --rot:${rot}deg;
      animation: curlyFly 2s cubic-bezier(0.1,0.6,0.35,1) ${delay}ms forwards;
    `;

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');

    // Three curl styles matching the image
    if (curlType === 0) {
      // tight S-curl spiral
      path.setAttribute('d', 'M20,35 C5,30 5,20 20,20 C35,20 35,10 20,5');
    } else if (curlType === 1) {
      // looping spiral coil
      path.setAttribute('d', 'M20,38 C8,35 4,25 12,18 C20,11 32,14 30,22 C28,30 18,32 15,26 C12,20 18,16 22,20');
    } else {
      // wide sweeping curl
      path.setAttribute('d', 'M5,30 C5,15 15,5 25,10 C35,15 38,28 28,33 C18,38 10,32 12,24');
    }

    svg.appendChild(path);
    container.appendChild(svg);
    setTimeout(() => svg.remove(), 2500);
  }
}


// ------ Interaction -----------------------------------------
function handleTap(clientX, clientY) {
  if (!gameActive || focusedEgg) return;
  const rect = canvas.getBoundingClientRect();
  const tx = clientX - rect.left, ty = clientY - rect.top;

  for (let i = eggs.length-1; i >= 0; i--) {
    const e = eggs[i];
    const rx = 26*e.scale, ry = 36*e.scale;
    const dx = tx - e.x, dy = ty - e.y;
    if ((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1) {
      focusedEgg = e; gameActive = false; clearInterval(spawnTimer);
      setTimeout(() => { showScreen(3); startLoading(); }, 5000);
      return;
    }
  }
}

// ------ Main Game Loop --------------------------------------
function gameLoop() {
  drawScene();
  const now = performance.now();
  splats = splats.filter(s => {
    const age = now - s.born; s.alpha = Math.max(0, 1 - (age-1600)/1400);
    drawSplat(s); return s.alpha > 0;
  });

  eggs = eggs.filter(e => {
    if (focusedEgg) {
      if (e === focusedEgg) {
        const targetX = canvas.width / 2, targetY = canvas.height / 2;
        e.x += (targetX - e.x) * ZOOM_SPEED;
        e.y += (targetY - e.y) * ZOOM_SPEED;
        e.scale += (2.8 - e.scale) * ZOOM_SPEED;
        e.rotation *= 0.8;
        const dist = Math.hypot(targetX - e.x, targetY - e.y);

        // --- CINEMATIC SLOW SEQUENCE ---
        if (dist < 4 && !e.cracked) {
          e.cracked = true; e.crackProgress = 0;
          playSound('crack');

          const crackDuration = 2000; // Slow growth
          const intervalStep = 30;
          
          const crackInterval = setInterval(() => {
            e.crackProgress += (intervalStep / crackDuration);
            // Intensifying vibration
            const shake = 12 * e.crackProgress;
            e.x += (Math.random()-0.5)*shake; e.y += (Math.random()-0.5)*shake;
            if (e.crackProgress >= 1) { e.crackProgress = 1; clearInterval(crackInterval); }
          }, intervalStep);

          setTimeout(() => {
            if (!e.popping) { e.popping = true; playSound('pop'); spawnConfetti(e.x, e.y); }
          }, crackDuration); 
        }
        if (e.popping) { e.popR += 14; drawPop(e); return e.popAlpha > 0; }
        drawEgg(e); return true;
      } else {
        ctx.globalAlpha = Math.max(0, (ctx.globalAlpha || 1) - 0.15);
        drawEgg(e); ctx.globalAlpha = 1.0; return false;
      }
    }
    e.vy = Math.min(e.vy + e.acc, 7.5); e.y += e.vy; e.x += e.vx; e.rotation += e.rotSpeed;
    if (e.y + 36*e.scale >= GROUND_Y) { playSound('splat'); splats.push(createSplat(e.x, e.color)); return false; }
    drawEgg(e); return e.alive;
  });

  if (gameActive || focusedEgg || splats.length > 0) requestAnimationFrame(gameLoop);
}

function dramaticEntrance() {
  for (let i = 0; i < 22; i++) { setTimeout(() => { eggs.push(createEgg(null, true)); }, i * 80); }
  setTimeout(() => {
    eggs.forEach(e => { e.vy = EGG_MIN_SPD + Math.random() * (EGG_MAX_SPD - EGG_MIN_SPD); });
    spawnTimer = setInterval(() => { if (gameActive) eggs.push(createEgg()); }, SPAWN_RATE);
  }, 2200);
}

function initGame() {
  canvas = document.getElementById('egg-canvas');
  ctx = canvas.getContext('2d');
  eggs = []; splats = []; focusedEgg = null; gameActive = true;
  preloadSounds();
  function resize() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    GROUND_Y = canvas.height - 85; buildGrass(); buildClouds();
  }
  resize(); window.addEventListener('resize', resize);
  canvas.addEventListener('click', e => handleTap(e.clientX, e.clientY));
  canvas.addEventListener('touchstart', e => { e.preventDefault(); handleTap(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  dramaticEntrance();
  gameLoop();
}