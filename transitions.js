// ============================================================
//  transitions.js  —  Screen switching + URL param reading
// ============================================================

const urlParams   = new URLSearchParams(window.location.search);
window.PRANK_FROM = urlParams.get('from') || 'A friend';
window.PRANK_TO   = urlParams.get('to')   || 'You';

document.addEventListener('DOMContentLoaded', () => {

  const fromTag = document.getElementById('from-tag');
  if (fromTag && urlParams.get('from')) {
    fromTag.textContent = `🐣 From: ${window.PRANK_FROM}  →  To: ${window.PRANK_TO}`;
    fromTag.style.display = 'block';
  }

  const tapBtn = document.getElementById('tap-btn');
  if (tapBtn) tapBtn.addEventListener('click', () => showScreen(2));

  showScreen(1);
});

function showScreen(n) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const target = document.getElementById(`screen-${n}`);
  if (!target) {
    console.warn(`showScreen: no element with id "screen-${n}"`);
    return;
  }

  setTimeout(() => {
    target.classList.add('active');
    if (n === 2) initGame();   // start egg game when screen 2 shows
  }, 80);

  console.log(`▶ Screen ${n} active`);
}