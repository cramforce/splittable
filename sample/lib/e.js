import {one} from './has-only-one-dependency';

// Don't add more dependencies to e.
export function e() {
  return class Foo {
    constructor() {
      console.log(e);
    }
  };
}