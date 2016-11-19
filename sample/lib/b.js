var required = require('./c').c;

required();

console.log('in b');

self.System.import('sample/lib/a').then(function(module) {
  console.log('imported sample/lib/a');
  module.test();
});

export function test() {
  console.log('loaded b');
};