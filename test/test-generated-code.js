/*
 * Copyright 2016 Malte Ubl.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require('fs-extra')
var t = require('tap');
var splittable = require('../index');
var child = require('child_process');

function evalInScope() {
  var console = {
    str: '',
    log: function() {
      this.str += Array.from(arguments).join(',') + '\n';
    }
  };
  // Used for global scope in bundle wrapper.
  var self = {};
  eval(arguments[0] + arguments[1] + arguments[2])
  return console.str;
}

function testGeneratedCode(t) {
  var base = fs.readFileSync('test-out/_base.js', 'utf8');
  var a = fs.readFileSync('test-out/sample-lib-a.js', 'utf8');
  var b = fs.readFileSync('test-out/sample-lib-b.js', 'utf8');

  var output = 'd export\n'
      + 'in c\n'
      + 'd export\n'
      + 'function (){console.log(b)}\n'
      + 'c export\n'
      + 'in a,\n'
      + 'c export\n'
      + 'in b\n';
  t.equal(evalInScope(base, a, b), output);
  t.equal(evalInScope(a, b, base), output);
  t.equal(evalInScope(a, base, b), output);
}

t.test('generated code JS API', function(t) {
  fs.emptyDirSync('test-out/');
  return splittable({
    modules: ['./sample/lib/a', './sample/lib/b'],
    writeTo: 'test-out/',
  }).then(function(info) {
    testGeneratedCode(t);
  });
});

t.test('generated code command line', function(t) {
  fs.emptyDirSync('test-out/');
  child.execSync(
      './bin.js ./sample/lib/a ./sample/lib/b --write-to=test-out/');
  testGeneratedCode(t);
  t.end();
});
