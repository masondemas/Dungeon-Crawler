# Dungeon Crawler

A first-person melee dungeon crawler that runs in your browser.
Built with plain HTML + JavaScript and [Three.js](https://threejs.org/).

**Play:** https://masondemas.github.io/Dungeon-Crawler/

## Controls

- Click the screen to start
- **W A S D**: move
- **Mouse**: look around
- **Shift**: run
- **Left click**: attack
- **Hold left click**: power attack (release to strike)
- **Hold right click**: block
- **1 – 4**: switch weapon (dagger, sword, axe, mace)
- **R**: drink a healing potion
- **M**: mute / unmute
- **Q**: switch shield · **X**: switch armor (test keys)
- **Esc**: release the mouse

## Run it on your own computer

Open a terminal in this folder and run:

    python3 -m http.server 8000

Then visit http://localhost:8000. Double-clicking `index.html` won't work.

Two levels, each ending in a boss. Kill the boss, then walk into the glowing exit.

Want to design a level? Edit the text maps in [levels.js](levels.js).

Want real sound effects? Drop `.mp3` files into the [sounds](sounds/) folder (see its README).

See [NOTES.md](NOTES.md) for the game design, progress and plans.
