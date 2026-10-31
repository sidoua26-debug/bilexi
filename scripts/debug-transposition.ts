import { weightedDistance } from '../engine/distance.ts';

console.log("weightedDistance('recieve', 'receive'):", weightedDistance('recieve', 'receive'));
console.log("weightedDistance('RECIEVE', 'receive'):", weightedDistance('RECIEVE', 'receive'));
