# Sound files

Drop real audio files in this folder to replace the game's generated placeholder sounds.

Name each file **exactly** like the sound it replaces, as an `.mp3`, for example
`hitFlesh.mp3`. Reload the game and it's used straight away. Any sound without a
file keeps using the generated version.

| File name | When it plays |
|---|---|
| `swingLight.mp3` | Swinging a dagger or sword |
| `swingHeavy.mp3` | Swinging an axe or mace, and power attacks |
| `hitFlesh.mp3` | Hitting a Ghoul or the Crypt Lord |
| `hitBone.mp3` | Hitting a Skeleton or the Bone Colossus |
| `hitStraw.mp3` | Hitting a training dummy |
| `hitShield.mp3` | An enemy's hit landing on your shield |
| `blockWeapon.mp3` | Blocking with just your weapon (no shield) |
| `hitWall.mp3` | Your swing hitting a wall |
| `playerGrunt.mp3` | Your effort grunt when swinging |
| `playerHurt.mp3` | You getting hurt |
| `enemyGroan.mp3` | Nearby Ghouls and bosses (bosses play it deeper) |
| `boneRattle.mp3` | Nearby Skeletons |

Tips:
- Keep files short (most under 1 second; groans 1–2 seconds) and quiet-ish.
  The game adds its own volume and pitch changes.
- Want a different name or format (`.ogg`, `.wav`)? Change the matching line in
  `SOUND_FILES` in `sounds.js`.
