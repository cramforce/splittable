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

var Promise = require('bluebird');
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
  var children = [];
  var document = {
    createElement: function(name) {
      return {
        tagName: name
      };
    },
    head: {
      appendChild: function(child) {
        children.push(child);
      }
    }
  };
  // Used for global scope in bundle wrapper.
  var self = {};
  eval(arguments[0] + arguments[1] + arguments[2])
  return {
    console: console,
    children: children,
    self: self,
  };
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
  var withImport = 'imported sample/lib/a\n'
      + 'loaded a\n';
  var result = evalInScope(base, a, b);
  t.equal(result.console.str, output);
  t.equal(result.self.process.env.NODE_ENV, 'production');
  t.equal(result.self, result.self.global);

  return Promise.resolve().then(function() {
    t.equal(result.console.str, output + withImport);

    // Order 2
    result = evalInScope(a, b, base);
    t.equal(result.console.str, output);
    return Promise.resolve().then(function() {
      t.equal(result.console.str, output + withImport);

      // Order 3
      result = evalInScope(a, base, b);
      t.equal(result.console.str, output);
      return Promise.resolve().then(function() {
        t.equal(result.console.str, output + withImport);
      });
    });
  });

  return Promise.resolve();
}

function testImportViaScript(t) {
  var base = fs.readFileSync('test-out/_base.js', 'utf8');
  var a = fs.readFileSync('test-out/sample-lib-a.js', 'utf8');
  var b = fs.readFileSync('test-out/sample-lib-b.js', 'utf8');

  var result = evalInScope(
      base,
      'self.System.import("sample/lib/a").then(function(m) {console.log("A");m.test()});\n' +
      'self.System.import("sample/lib/b").then(function(m) {console.log("B1");m.test()});\n' +
      'self.System.import("sample/lib/b").then(function(m) {console.log("B2");m.test()});\n',
      b + a);

  t.equal(result.children.length, 2);
  result.children[0].onload();
  result.children[1].onload();

  var output = 'd export\n'
    + 'in c\n'
    + 'c export\n'
    + 'in b\n'
    + 'd export\n'
    + 'function (){console.log(b)}\n'
    + 'c export\n'
    + 'in a,\n'
    + 'A\n'
    + 'loaded a\n'
    + 'imported sample/lib/a\n'
    + 'loaded a\n'
    + 'B1\n'
    + 'loaded b\n'
    + 'B2\n'
    + 'loaded b\n'

  return Promise.resolve().then(function() {
    t.equal(result.console.str, output);
  });
}

t.test('generated code JS API', function(t) {
  fs.emptyDirSync('test-out/');
  return splittable({
    modules: ['./sample/lib/a', './sample/lib/b'],
    writeTo: 'test-out/',
  }).then(function(info) {
    return testGeneratedCode(t).then(function() {
      return testImportViaScript(t)
    });
  });
});

t.test('generated code command line', function(t) {
  fs.emptyDirSync('test-out/');
  child.execSync(
      'node ./bin.js ./sample/lib/a ./sample/lib/b --write-to=test-out/');
  return testGeneratedCode(t);
});
