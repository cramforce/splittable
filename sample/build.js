

var splittable = require('../splittable');

splittable({
  modules: ['./lib/a', './lib/b'],
  writeTo: 'out/',
}).then(function() {
  console.info('Compilation successful');
}, function(reason) {
  console.error('Compilation failed', reason);
});