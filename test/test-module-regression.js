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

var t = require('tap');
var fs = require('fs-extra');
var splittable = require('../index');

t.test('module regression: bel', function(t) {
  fs.emptyDirSync('test-out/');
  return splittable({
    modules: ['./test/module-regression/bel.js'],
    writeTo: 'test-out/',
  });
});

t.test('module regression: preact TODO mvc (loaded via submodule)', function(t) {
  var wdir = process.cwd();
  process.chdir('./test/module-regression/preact-todomvc/');
  fs.emptyDirSync('test-out/');
  return splittable({
    modules: [
      './src/index',
    ],
    writeTo: 'test-out/',
    babel: {
      plugins: [
        'transform-object-rest-spread',
        ['transform-react-jsx', { pragma:'h' }]
      ],
    }
  }).catch(function(reason) {
    process.chdir(wdir);
    throw reason;
  });
});
