// ============================================================
//  transitions.js  —  Screen switching + URL param reading
// ============================================================

// ------ Global prank params (read once, used everywhere) ----
const urlParams  = new URLSearchParams(window.location.search);
window.PRANK_FROM = urlParams.get('from') || 'A friend';   // sender name
window.PRANK_TO   = urlParams.get('to')   || 'You';        // recipient name

// ------ Show the right screen on load -----------------------
document.addEventListener('DOMContentLoaded', () => {

  // Personalise Screen 1 greeting if a "from" name was passed
  const fromTag = document.getElementById('from-tag');
  if (fromTag && urlParams.get('from')) {
    fromTag.textContent = `🐣 From: ${window.PRANK_FROM}  →  To: ${window.PRANK_TO}`;
    fromTag.style.display = 'block';
  }

  // Always start on Screen 1
  showScreen(1);
});

// ------ Core transition function ----------------------------
/**
 * showScreen(n)
 * Hides every screen, then fades in screen-n.
 * Call this from game.js, loading.js, or any inline handler.
 *
 * @param {number} n  — screen number (1‑5)
 */
function showScreen(n) {
  const all = document.querySelectorAll('.screen');

  all.forEach(s => {
    s.classList.remove('active');
  });

  const target = document.getElementById(`screen-${n}`);
  if (!target) {
    console.warn(`showScreen: no element with id "screen-${n}"`);
    return;
  }

  // Small delay so the fade-out finishes before fade-in starts
  setTimeout(() => {
    target.classList.add('active');
  }, 80);

  console.log(`▶ Screen ${n} active`);
  setTimeout(() => {
    target.classList.add('active');
    if (n === 2) initGame();  // ← add this line
  }, 80);
}