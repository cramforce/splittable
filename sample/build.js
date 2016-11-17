#!/usr/bin/env node

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

var splittable = require('../index');

splittable({
  modules: [/*'./lib/a', './lib/b', './lib/no-deps',*/ './lib/index-module'],
  writeTo: 'out/',
}).then(function(info) {
  console.info('Compilation successful');
  if (info.warnings) {
    console.warn(info.warnings);
  }
}, function(reason) {
  console.error('Compilation failed', reason);
});
