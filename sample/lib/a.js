import {c} from './c';
import {d} from './d';
import {e} from './e';

d();
e();

console.log('in a', c());

console.log(require('./data.json').test);

export function test() {
  console.log('loaded a');
};

console.log(process.env.NODE_ENV);
