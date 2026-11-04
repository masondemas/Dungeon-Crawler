// =============================================================
//  Progress: carries your potions and gear from one level to the next
// =============================================================
// Saved in the browser's "session storage", which lasts until you close the tab.
// If the browser blocks it, the game still works; you just start each level fresh.

const KEY = 'dungeon-crawler-progress';

export function loadProgress() {
  try {
    const text = sessionStorage.getItem(KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage not available: nothing to do
  }
}

export function clearProgress() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage not available: nothing to do
  }
}
