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
var stringify = require('json-stable-stringify');
var getGraph = require('../splittable').getGraph;
var getBundleFlags = require('../splittable').getBundleFlags;
var getFlags = require('../splittable').getFlags;

function jsonEqual(t, a, b, message) {
  t.equal(
      stringify(a, {space: 0}),
      stringify(b, {space: 0}),
      message);
}

t.test('module order with 2 modules', function(t) {
  return getGraph(['./sample/lib/a', './sample/lib/b']).then(function(g) {
    jsonEqual(t, g.bundles, {
      "_base": {
        "name": "_base",
        "modules": [
          "sample/lib/d.js",
          "sample/lib/c.js"
        ]
      },
      "sample/lib/b.js": {
        "name": "sample/lib/b.js",
        "modules": [
          "sample/lib/b.js"
        ]
      },
      "sample/lib/a.js": {
        "name": "sample/lib/a.js",
        "modules": [
          "sample/lib/e.js",
          "sample/lib/a.js"
        ]
      }
    });

    jsonEqual(t, getBundleFlags(g), [
      "--js", "sample/lib/d.js",
      "--js", "sample/lib/c.js",
      "--module", "_base:2",
      "--js", "sample/lib/e.js",
      "--js", "sample/lib/a.js",
      "--module", "sample-lib-a:2:_base",
      "--js", "sample/lib/b.js",
      "--module", "sample-lib-b:1:_base"
    ]);
  });
});

t.test('accepts different module input syntax', function(t) {
  return getGraph(['sample/lib/b.js']).then(function(g) {
    jsonEqual(t, g.bundles, {
      "sample/lib/b.js": {
        "name": "sample/lib/b.js",
        "modules": [
          "sample/lib/d.js",
          "sample/lib/c.js",
          "sample/lib/b.js"
        ]
      },
    });

    jsonEqual(t, getBundleFlags(g), [
      "--js", "sample/lib/d.js",
      "--js", "sample/lib/c.js",
      "--js", "sample/lib/b.js",
      "--module", "sample-lib-b:3"
    ]);
  });
});

t.test('module order with 3 modules', function(t) {
  return getGraph(['./sample/lib/a', './sample/lib/b',
      './sample/lib/no-deps']).then(function(g) {
        jsonEqual(t, g.bundles, {
          "_base": {
            "name": "_base",
            "modules": [
              "sample/lib/d.js",
              "sample/lib/c.js"
            ]
          },
          "sample/lib/b.js": {
            "name": "sample/lib/b.js",
            "modules": [
              "sample/lib/b.js"
            ]
          },
          "sample/lib/a.js": {
            "name": "sample/lib/a.js",
            "modules": [
              "sample/lib/e.js",
              "sample/lib/a.js"
            ]
          },
          "sample/lib/no-deps.js": {
            "modules": [
             "sample/lib/no-deps.js"
            ],
            "name": "sample/lib/no-deps.js"
          }
        });
      });
});

t.test('getFlags', function(t) {
  return getFlags({
      modules: ['./sample/lib/b']
    }).then(function(flags) {

    jsonEqual(t, flags, [
      "--compilation_level", "ADVANCED",
      "--create_source_map", "%outname%.map",
      "--language_in", "ES6",
      "--language_out", "ES5",
      "--module_output_path_prefix", "out/",
      "--new_type_inf", true,
      "--process_common_js_modules", true,
      "--rewrite_polyfills", true,
      "--js", "sample/lib/d.js",
      "--js", "sample/lib/c.js",
      "--js", "sample/lib/b.js",
      "--module", "sample-lib-b:3"
    ]);
  });
});
