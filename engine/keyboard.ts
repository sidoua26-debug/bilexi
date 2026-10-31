/**
 * Keyboard layout modeling and key adjacency maps (QWERTY / AZERTY)
 */

const QWERTY_ROWS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

const AZERTY_ROWS = [
  'azertyuiop',
  'qsdfghjklm',
  'wxcvbn',
];

type AdjacencyMap = Map<string, Set<string>>;

function buildAdjacencyMap(rows: string[]): AdjacencyMap {
  const map: AdjacencyMap = new Map();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      const char = row[c]!;
      let set = map.get(char);
      if (!set) {
        set = new Set();
        map.set(char, set);
      }

      // Same row neighbors
      if (c > 0) set.add(row[c - 1]!);
      if (c < row.length - 1) set.add(row[c + 1]!);

      // Adjacent row neighbors (with slight stagger +/- 1)
      if (r > 0) {
        const prevRow = rows[r - 1]!;
        for (let dc = -1; dc <= 1; dc++) {
          const neighborCol = c + dc;
          if (neighborCol >= 0 && neighborCol < prevRow.length) {
            set.add(prevRow[neighborCol]!);
          }
        }
      }

      if (r < rows.length - 1) {
        const nextRow = rows[r + 1]!;
        for (let dc = -1; dc <= 1; dc++) {
          const neighborCol = c + dc;
          if (neighborCol >= 0 && neighborCol < nextRow.length) {
            set.add(nextRow[neighborCol]!);
          }
        }
      }
    }
  }

  return map;
}

const qwertyAdjacency = buildAdjacencyMap(QWERTY_ROWS);
const azertyAdjacency = buildAdjacencyMap(AZERTY_ROWS);

export function isAdjacentKey(
  ch1: string,
  ch2: string,
  layout: 'qwerty' | 'azerty' = 'qwerty'
): boolean {
  const a = ch1.toLowerCase();
  const b = ch2.toLowerCase();
  if (a === b) return false;

  const map = layout === 'azerty' ? azertyAdjacency : qwertyAdjacency;
  const neighbors = map.get(a);
  return neighbors ? neighbors.has(b) : false;
}
