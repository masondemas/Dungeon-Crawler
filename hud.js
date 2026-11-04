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
const potionBox = document.getElementById('potions');
const potionCount = document.getElementById('potion-count');
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
  healthBar.el.classList.toggle('regen', !!player.regenerating);
  potionCount.textContent = player.potions;
  potionBox.classList.toggle('empty', player.potions === 0);

  // Fade out the red hurt flash
  flashAmount = Math.max(0, flashAmount - dt * 2);
  hurtFlash.style.opacity = flashAmount;
}

// Called by the game when the player takes damage
export function flashHurt() {
  flashAmount = 1;
}

// Shows a number that floats up and fades out at a spot on the screen (in pixels)
export function showDamageNumber(screenX, screenY, amount, isPower = false) {
  const el = document.createElement('div');
  el.className = isPower ? 'damage-number power' : 'damage-number';
  el.textContent = amount;
  el.style.left = `${screenX + (Math.random() * 30 - 15)}px`;
  el.style.top = `${screenY}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900); // matches the animation length in index.html
}

// ---------- Power attack charge (shown on the crosshair) ----------
const crosshair = document.getElementById('crosshair');

// charge = null (not charging) or { amount: 0..1, possible: true/false }
export function setCharge(charge) {
  if (!charge) {
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.setProperty('--cross-colour', 'rgba(255, 255, 255, 0.85)');
    return;
  }
  const scale = 1 + charge.amount * 0.9;
  crosshair.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${charge.amount * 45}deg)`;
  // Orange when charging, red when fully charged, grey if you're too tired to power attack
  const colour = !charge.possible ? 'rgba(150, 150, 150, 0.8)'
    : charge.amount >= 1 ? 'rgba(255, 70, 40, 1)'
    : 'rgba(255, 170, 60, 0.95)';
  crosshair.style.setProperty('--cross-colour', colour);
}

// ---------- Short messages in the middle of the screen ("Blocked!", etc.) ----------
const messageEl = document.getElementById('message');
let messageTimer = null;

export function showMessage(text, colour = '#e8dcc0') {
  messageEl.textContent = text;
  messageEl.style.color = colour;
  messageEl.classList.remove('show');
  void messageEl.offsetWidth; // restart the fade animation
  messageEl.classList.add('show');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => messageEl.classList.remove('show'), 700);
}

// Silver-blue flash around the screen edges when you block a hit
const blockFlash = document.getElementById('block-flash');
let blockFlashAmount = 0;
export function flashBlock() { blockFlashAmount = 1; }
export function updateFlashes(dt) {
  blockFlashAmount = Math.max(0, blockFlashAmount - dt * 3);
  blockFlash.style.opacity = blockFlashAmount;
}

// ---------- Weapon panel (bottom right): which weapon you're holding ----------
const weaponPanel = document.getElementById('weapon-panel');

export function setWeaponPanel(allWeapons, current, shield, armor) {
  weaponPanel.innerHTML = '';
  const name = document.createElement('div');
  name.className = 'weapon-name';
  name.textContent = current.name;
  weaponPanel.appendChild(name);

  const slots = document.createElement('div');
  slots.className = 'weapon-slots';
  allWeapons.forEach((weapon, i) => {
    const slot = document.createElement('span');
    slot.className = weapon === current ? 'slot current' : 'slot';
    slot.textContent = `${i + 1} ${weapon.model}`;
    slots.appendChild(slot);
  });
  weaponPanel.appendChild(slots);

  // Shield and armor lines
  const gear = document.createElement('div');
  gear.className = 'gear';
  const armorText = armor.damageReduction > 0 ? `${armor.name} (−${Math.round(armor.damageReduction * 100)}% damage)` : armor.name;
  gear.innerHTML = `<span>Q</span> ${shield ? shield.name : 'No Shield'}<br><span>X</span> ${armorText}`;
  weaponPanel.appendChild(gear);
}

// ---------- Boss health bar (top of the screen) ----------
const bossBar = document.getElementById('boss-bar');
const bossName = bossBar.querySelector('.boss-name');
const bossFill = bossBar.querySelector('.fill');

// boss = the boss enemy, or null to hide the bar
export function setBossBar(boss) {
  // (the controls hint hides during boss fights to make room for the bar)
  document.body.classList.toggle('boss-fight', !!boss);
  if (!boss) { bossBar.classList.add('hidden'); return; }
  bossBar.classList.remove('hidden');
  bossName.textContent = boss.type.name + (boss.enraged ? ' (enraged)' : '');
  bossFill.style.width = `${Math.max(0, boss.health / boss.maxHealth) * 100}%`;
  bossBar.classList.toggle('enraged', boss.enraged);
}
