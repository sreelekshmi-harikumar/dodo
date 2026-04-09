// ============================================================
//  game.js  —  Egg Falling Game (Cinematic Slow-Cracking Final)
//  Ground: smooth hills + scattered depth flower meadow
//  + Bunny encouragement popup system
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
let flowers    = [];
let spawnTimer = null;
let gameActive = false;
let GROUND_Y   = 0;
let focusedEgg = null;
let missedCount = 0;

// ------ Bunny System ----------------------------------------
// First message shown immediately on game start
const BUNNY_FIRST_MESSAGE = "Good luck!🍀";

// Subsequent messages shown at random intervals
const BUNNY_MESSAGES = [
  "Come on! You can do it! 🐣",
  "Try again, you've got this! ",
  "You're so close, I know it! 🌸",
  "Don't give up! 🐰",
  "Keep tapping! One will crack! ✨",
  "You can do it, I believe in you! 🥚",
];

let bunnyEl      = null;
let bunnyTimer   = null;
let bunnyVisible = false;
let bunnyDone    = false;

function createBunnyEl() {
  const wrap = document.createElement('div');
  wrap.id = 'bunny-wrap';
  wrap.style.cssText = `
    position: fixed; bottom: -220px; left: 50%;
    transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center;
    pointer-events: none; z-index: 999;
    transition: bottom 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  const bubble = document.createElement('div');
  bubble.className = 'bunny-bubble';
  bubble.style.cssText = `
    background: #fff; border: 3px solid #ff6eb4; border-radius: 18px;
    padding: 10px 18px; font-family: 'Fredoka One','Nunito',sans-serif;
    font-size: clamp(13px,3.5vw,17px); color: #c2185b;
    text-align: center; white-space: nowrap; margin-bottom: 6px;
    box-shadow: 0 4px 18px rgba(255,110,180,0.25); position: relative;
  `;
  const tail = document.createElement('div');
  tail.style.cssText = `
    width:0; height:0;
    border-left:10px solid transparent; border-right:10px solid transparent;
    border-top:12px solid #ff6eb4;
    position:absolute; bottom:-15px; left:50%; transform:translateX(-50%);
  `;
  bubble.appendChild(tail);
  const img = document.createElement('img');
  img.src = 'assets/Baby_Rabbit.gif';
  img.style.cssText = `width:clamp(70px,18vw,110px);height:auto;display:block;margin-top:8px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.18));`;
  wrap.appendChild(bubble);
  wrap.appendChild(img);
  document.body.appendChild(wrap);
  bunnyEl = wrap;
}

function showBunnyWithMessage(message) {
  if (bunnyDone || bunnyVisible || !bunnyEl) return;
  const bubble = bunnyEl.querySelector('.bunny-bubble');
  const tail   = bubble.querySelector('div');
  bubble.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
  bubble.insertBefore(document.createTextNode(message), tail);
  const bw=160, minX=bw/2+10, maxX=window.innerWidth-bw/2-10;
  bunnyEl.style.left = `${minX+Math.random()*(maxX-minX)}px`;
  bunnyEl.style.transform = 'translateX(-50%)';
  bunnyVisible = true;
  requestAnimationFrame(() => { bunnyEl.style.bottom = '0px'; });
  setTimeout(() => hideBunny(), 5000);
}

function showBunny() {
  // picks a random message from the regular pool
  showBunnyWithMessage(BUNNY_MESSAGES[Math.floor(Math.random() * BUNNY_MESSAGES.length)]);
}

function hideBunny() {
  if (!bunnyEl) return;
  bunnyEl.style.bottom = '-220px';
  setTimeout(() => { bunnyVisible = false; }, 900);
}

function stopBunny() {
  bunnyDone = true; clearInterval(bunnyTimer);
  if (bunnyEl) {
    bunnyEl.style.transition = 'bottom 0.3s ease';
    bunnyEl.style.bottom = '-220px';
    setTimeout(() => { if (bunnyEl) { bunnyEl.remove(); bunnyEl = null; } }, 400);
  }
}

function startBunnyScheduler() {
  createBunnyEl();

  // appear almost immediately (1.5s) with the good luck message
  setTimeout(() => {
    if (!bunnyDone) {
      showBunnyWithMessage(BUNNY_FIRST_MESSAGE);

      // then continue at random intervals with normal encouraging messages
      bunnyTimer = setInterval(() => {
        if (bunnyDone) { clearInterval(bunnyTimer); return; }
        showBunny();
      }, 10000 + Math.random() * 5000);
    }
  }, 1500);
}

// ------ Audio -----------------------------------------------
const SOUNDS = {};
function preloadSounds() {
  ['crack','splat','pop'].forEach(name => {
    const a = new Audio(`assets/${name}.mp3`); a.load(); SOUNDS[name] = a;
  });
}
function playSound(name) {
  try { const s=SOUNDS[name]; if(!s) return; s.currentTime=0; s.volume=0.7; s.play().catch(()=>{}); } catch(e) {}
}

// ------ Clouds ----------------------------------------------
function buildClouds() {
  clouds = [];
  for (let i=0; i<5; i++) clouds.push({x:Math.random()*canvas.width,y:28+Math.random()*70,r:26+Math.random()*26,speed:0.15+Math.random()*0.15,alpha:0.8+Math.random()*0.15});
}
function drawClouds() {
  clouds.forEach(c => {
    c.x += c.speed; if (c.x-c.r*2>canvas.width) c.x=-c.r*2;
    ctx.save(); ctx.globalAlpha=c.alpha; ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.arc(c.x+c.r*0.9,c.y+6,c.r*0.72,0,Math.PI*2);
    ctx.arc(c.x-c.r*0.85,c.y+8,c.r*0.65,0,Math.PI*2); ctx.arc(c.x+c.r*0.3,c.y-c.r*0.55,c.r*0.6,0,Math.PI*2);
    ctx.fill(); ctx.restore();
  });
}

// ------ Sun -------------------------------------------------
function drawSun() {
  const sx=canvas.width-65,sy=52,sr=28; ctx.save();
  const g=ctx.createRadialGradient(sx,sy,sr*0.4,sx,sy,sr*2.4);
  g.addColorStop(0,'rgba(255,235,80,0.4)'); g.addColorStop(1,'rgba(255,235,80,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,sy,sr*2.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFD93D'; ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFC300'; ctx.beginPath(); ctx.arc(sx,sy,sr*0.7,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ------ Flower Meadow ---------------------------------------
function shadeColor(col,amt){
  const n=parseInt(col.replace('#',''),16);
  return `rgb(${Math.min(255,Math.max(0,(n>>16)+amt))},${Math.min(255,Math.max(0,((n>>8)&0xff)+amt))},${Math.min(255,Math.max(0,(n&0xff)+amt))})`;
}

const FLOWER_COLS=[
  {petal:'#ff6eb4',centre:'#ffd93d'},{petal:'#b06aff',centre:'#ffd93d'},
  {petal:'#ffffff',centre:'#ffd93d'},{petal:'#ffd94a',centre:'#ff9f43'},
  {petal:'#4fc3f7',centre:'#ffffff'},{petal:'#ff9f43',centre:'#ffd93d'},
  {petal:'#fd79a8',centre:'#ffffff'},{petal:'#26de81',centre:'#ffd93d'},
  {petal:'#ff4757',centre:'#ffd93d'},{petal:'#f8bbd0',centre:'#ffd93d'},
];
const FLOWER_TYPES=['daisy','tulip','sunflower','simple'];

function buildFlowers() {
  flowers = [];
  const W = canvas.width;
  const layers = [
    { count:20, yMin:GROUND_Y+2,  yMax:GROUND_Y+20, sizeMin:2.5, sizeMax:4.5,  stemMin:8,  stemMax:15, alpha:0.55, leanMax:0.12 },
    { count:22, yMin:GROUND_Y+16, yMax:GROUND_Y+38, sizeMin:3.5, sizeMax:6.5,  stemMin:12, stemMax:22, alpha:0.72, leanMax:0.16 },
    { count:18, yMin:GROUND_Y+34, yMax:GROUND_Y+60, sizeMin:5,   sizeMax:9,    stemMin:16, stemMax:28, alpha:0.88, leanMax:0.18 },
    { count:12, yMin:GROUND_Y+55, yMax:GROUND_Y+82, sizeMin:7,   sizeMax:12,   stemMin:20, stemMax:34, alpha:1.0,  leanMax:0.22 },
  ];
  layers.forEach(l => {
    const positions=[], minGap=W/(l.count*1.5);
    let attempts=0;
    while (positions.length<l.count && attempts<400) {
      attempts++;
      const x=10+Math.random()*(W-20);
      if (positions.every(p=>Math.abs(p-x)>minGap)) positions.push(x);
    }
    positions.forEach(x => {
      const c=FLOWER_COLS[Math.floor(Math.random()*FLOWER_COLS.length)];
      const t=FLOWER_TYPES[Math.floor(Math.random()*FLOWER_TYPES.length)];
      flowers.push({
        x, y:l.yMin+Math.random()*(l.yMax-l.yMin),
        stemH:l.stemMin+Math.random()*(l.stemMax-l.stemMin),
        size:l.sizeMin+Math.random()*(l.sizeMax-l.sizeMin),
        petal:c.petal, centre:c.centre, type:t,
        lean:(Math.random()-0.5)*l.leanMax, alpha:l.alpha,
      });
    });
  });
  flowers.sort((a,b)=>a.y-b.y);
}

function drawDaisy(f){
  const cx=f.x,cy=f.y-f.stemH,r=f.size,n=7;
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2; ctx.fillStyle=f.petal; ctx.beginPath();
    ctx.ellipse(cx+Math.cos(a)*r*1.1,cy+Math.sin(a)*r*1.1,r*0.52,r*0.82,a,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle=f.centre; ctx.beginPath(); ctx.arc(cx,cy,r*0.52,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.arc(cx,cy,r*0.26,0,Math.PI*2); ctx.fill();
}

function drawTulip(f){
  const cx=f.x,cy=f.y-f.stemH,pw=f.size;
  ctx.fillStyle=shadeColor(f.petal,-30);
  ctx.beginPath(); ctx.moveTo(cx,cy+pw*0.4);
  ctx.bezierCurveTo(cx-pw*1.2,cy+pw*0.1,cx-pw*1.0,cy-pw*1.7,cx-pw*0.15,cy-pw*2.0);
  ctx.bezierCurveTo(cx-pw*0.4,cy-pw*1.3,cx-pw*0.35,cy-pw*0.4,cx,cy+pw*0.4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx,cy+pw*0.4);
  ctx.bezierCurveTo(cx+pw*1.2,cy+pw*0.1,cx+pw*1.0,cy-pw*1.7,cx+pw*0.15,cy-pw*2.0);
  ctx.bezierCurveTo(cx+pw*0.4,cy-pw*1.3,cx+pw*0.35,cy-pw*0.4,cx,cy+pw*0.4); ctx.fill();
  ctx.fillStyle=f.petal;
  ctx.beginPath(); ctx.moveTo(cx,cy+pw*0.45);
  ctx.bezierCurveTo(cx-pw*0.85,cy+pw*0.1,cx-pw*0.7,cy-pw*1.55,cx,cy-pw*1.95);
  ctx.bezierCurveTo(cx+pw*0.7,cy-pw*1.55,cx+pw*0.85,cy+pw*0.1,cx,cy+pw*0.45); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(cx,cy+pw*0.1);
  ctx.bezierCurveTo(cx-pw*0.28,cy-pw*0.2,cx-pw*0.22,cy-pw*1.0,cx,cy-pw*1.45);
  ctx.bezierCurveTo(cx+pw*0.22,cy-pw*1.0,cx+pw*0.28,cy-pw*0.2,cx,cy+pw*0.1); ctx.fill();
}

function drawSunflower(f){
  const cx=f.x,cy=f.y-f.stemH,r=f.size,n=12;
  ctx.fillStyle='#ffd93d';
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2; ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0,-r*1.3,r*0.36,r*0.9,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle='#5d3a00'; ctx.beginPath(); ctx.arc(cx,cy,r*0.6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#7a4f00'; ctx.beginPath(); ctx.arc(cx,cy,r*0.38,0,Math.PI*2); ctx.fill();
}

function drawSimple(f){
  const cx=f.x,cy=f.y-f.stemH,r=f.size,n=5;
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2; ctx.fillStyle=f.petal; ctx.beginPath();
    ctx.arc(cx+Math.cos(a)*r*0.9,cy+Math.sin(a)*r*0.9
