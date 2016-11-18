var required = require('./c').c;

required();

console.log('in b');

System.import('lib/a').then(function(module) {
  module.test();
});