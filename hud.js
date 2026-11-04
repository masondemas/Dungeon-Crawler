// =============================================================
//  HUD: the health and stamina bars on screen
// =============================================================
// The game tells the HUD the player's numbers every frame,
// and the HUD makes the bars match.

// Finds the pieces of one bar on the page
function findBar(id) {
  const el = document.getElementById(id);
  return {
    el,
    fill: el.querySelector('.fill'),
    ghost: el.querySelector('.ghost'),
    label: el.querySelector('.label'),
    ghostValue: 1,      // the pale "you just lost this much" part (0 to 1)
    ghostWait: 0,       // seconds before the pale part starts shrinking
  };
}

const healthBar = findBar('health-bar');
const staminaBar = findBar('stamina-bar');
const hurtFlash = document.getElementById('hurt-flash');
let flashAmount = 0;

function updateBar(bar, value, max, dt) {
  const fraction = Math.max(0, value / max);

  // The pale part waits a moment, then slides down to catch up with the real bar
  if (fraction >= bar.ghostValue) {
    bar.ghostValue = fraction;
    bar.ghostWait = 0.6;
  } else if (bar.ghostWait > 0) {
    bar.ghostWait -= dt;
  } else {
    bar.ghostValue = Math.max(fraction, bar.ghostValue - dt * 0.8);
  }

  bar.fill.style.width = `${fraction * 100}%`;
  bar.ghost.style.width = `${bar.ghostValue * 100}%`;
  bar.label.textContent = `${Math.ceil(value)} / ${max}`;
}

// Called by the game every frame
export function updateHUD(player, dt) {
  updateBar(healthBar, player.health, player.maxHealth, dt);
  updateBar(staminaBar, player.stamina, player.maxStamina, dt);
  staminaBar.el.classList.toggle('winded', player.winded);

  // Fade out the red hurt flash
  flashAmount = Math.max(0, flashAmount - dt * 2);
  hurtFlash.style.opacity = flashAmount;
}

// Called by the game when the player takes damage
export function flashHurt() {
  flashAmount = 1;
}

// Shows a number that floats up and fades out at a spot on the screen (in pixels)
export function showDamageNumber(screenX, screenY, amount) {
  const el = document.createElement('div');
  el.className = 'damage-number';
  el.textContent = amount;
  el.style.left = `${screenX + (Math.random() * 30 - 15)}px`;
  el.style.top = `${screenY}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900); // matches the animation length in index.html
}
