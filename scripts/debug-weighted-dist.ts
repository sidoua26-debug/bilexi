import { weightedDistance } from '../engine/distance.ts';

const pairs = [
  ['recieve', 'receive'],
  ['RECIEVE', 'receive'],
  ['recieve', 'relieve'],
  ['RECIEVE', 'relieve']
];

for (const [a, b] of pairs) {
  console.log(`weightedDistance('${a}', '${b}'): ${weightedDistance(a, b)}`);
}
