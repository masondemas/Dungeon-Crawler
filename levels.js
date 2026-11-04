// =============================================================
//  Level maps
// =============================================================
// Each level is drawn as text. Every character is one 2 x 2 metre square:
//
//   #  wall
//   .  floor
//   S  floor where the player starts
//   P  floor with a stone pillar on it
//   T  wall with a torch on it (torch faces the nearest floor)
//   R  wall with a red torch on it (used for the boss room)
//   D  floor with a training dummy on it (something to practise hitting)
//   E  floor with an enemy (a Ghoul) on it
//
// Rows go from north (top) to south (bottom). All rows must be the same length.
// To make a new level, copy one of these, change the map, and add it to the list.

export const LEVELS = [
  {
    name: 'Level 1: The Old Crypt',
    startFacing: 'east', // which way the player looks at the start: north, south, east or west
    map: [
      '############T#######T###',
      '#....D.T####.........###',
      '#......#####.........###',
      'T..S..........P...P..###',
      '#....................###',
      '#......#####...D.....T##',
      '#....D.#####.........###',
      '############..P...P..###',
      '###########T.......E.###',
      '############.........###',
      '################..######',
      '################..######',
      '################..######',
      '################..######',
      '#############......E..##',
      '#########T###.........##',
      '######................T#',
      '######..E.............##',
      '######..#####.........##',
      '######..#####..E......##',
      '######..#####T#######T##',
      '#####R..####R###########',
      '##..............########',
      '##..............########',
      '#R..............R#######',
      '##..............########',
      '##...P......P...########',
      '##..............########',
      '##..............########',
      '##...P......P...########',
      '#R..............R#######',
      '##..............########',
      '##..............########',
      '########R###############',
    ],
  },
];
