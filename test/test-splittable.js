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
var splittable = require('../splittable');

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
        "isBase": true,
        "name": "_base",
        "modules": [
          "sample/lib/d.js",
          "sample/lib/c.js"
        ]
      },
      "sample/lib/b.js": {
        "isBase": false,
        "name": "sample/lib/b.js",
        "modules": [
          "sample/lib/b.js"
        ]
      },
      "sample/lib/a.js": {
        "isBase": false,
        "name": "sample/lib/a.js",
        "modules": [
          "sample/lib/has-only-one-dependency.js",
          "sample/lib/e.js",
          "sample/lib/a.js"
        ]
      }
    });

    jsonEqual(t, makeVariableFileNamesConsistent(getBundleFlags(g)), [
      "--js", "sample/lib/d.js",
      "--js", "sample/lib/c.js",
      "--module", "_base:2",
      "--module_wrapper", "_base:" + splittable.baseBundleWrapper,
      "--js", "sample/lib/has-only-one-dependency.js",
      "--js", "sample/lib/e.js",
      "--js", "sample/lib/a.js",
      "--js", "$TMP_FILE",
      "--module", "sample-lib-a:4:_base",
      "--module_wrapper", "sample-lib-a:" + splittable.bundleWrapper,
      "--js", "sample/lib/b.js",
      "--js", "$TMP_FILE",
      "--module", "sample-lib-b:2:_base",
      "--module_wrapper", "sample-lib-b:" + splittable.bundleWrapper,
    ]);
  });
});

t.test('module order with 2 modules and no overlap', function(t) {
  return getGraph(['./sample/lib/d', './sample/lib/e']).then(function(g) {
    jsonEqual(t, g.bundles, {
      "_base": {
        "isBase": true,
        "name": "_base",
        "modules": [
        ]
      },
      "sample/lib/d.js": {
        "isBase": false,
        "name": "sample/lib/d.js",
        "modules": [
          "sample/lib/d.js"
        ]
      },
      "sample/lib/e.js": {
        "isBase": false,
        "name": "sample/lib/e.js",
        "modules": [
          "sample/lib/has-only-one-dependency.js",
          "sample/lib/e.js"
        ]
      }
    });
  });
});

t.test('accepts different module input syntax', function(t) {
  return getGraph(['sample/lib/b.js']).then(function(g) {
    jsonEqual(t, g.bundles, {
      "sample/lib/b.js": {
        "isBase": false,
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
      "--module", "sample-lib-b:3",
    ]);
  });
});

t.test('packages', function(t) {
  return getGraph(['sample/lib/other-module-root']).then(function(g) {
    jsonEqual(t, g.bundles, {
      "sample/lib/other-module-root.js": {
        "isBase": false,
        "name": "sample/lib/other-module-root.js",
        "modules": [
          "node_modules/d3-array/build/d3-array.js",
          "node_modules/d3-path/build/d3-path.js",
          "node_modules/d3-shape/build/d3-shape.js",
          "node_modules/left-pad/index.js",
          "node_modules/promise-pjs/promise.js",
          "sample/lib/other-module-root.js",
        ]
      },
    });

    jsonEqual(t, getBundleFlags(g), [
      "--js", "node_modules/d3-array/package.json",
      "--js", "node_modules/d3-path/package.json",
      "--js", "node_modules/d3-shape/package.json",
      "--js", "node_modules/left-pad/package.json",
      "--js", "node_modules/promise-pjs/package.json",
      "--js", "node_modules/d3-array/build/d3-array.js",
      "--js", "node_modules/d3-path/build/d3-path.js",
      "--js", "node_modules/d3-shape/build/d3-shape.js",
      "--js", "node_modules/left-pad/index.js",
      "--js", "node_modules/promise-pjs/promise.js",
      "--js", "sample/lib/other-module-root.js",
      "--module", "sample-lib-other-module-root:11",
    ]);
  });
});

t.test('module order with 3 modules', function(t) {
  return getGraph(['./sample/lib/a', './sample/lib/b',
      './sample/lib/no-deps']).then(function(g) {
        jsonEqual(t, g.bundles, {
          "_base": {
            "isBase": true,
            "name": "_base",
            "modules": [
              "sample/lib/d.js",
              "sample/lib/c.js"
            ]
          },
          "sample/lib/b.js": {
            "isBase": false,
            "name": "sample/lib/b.js",
            "modules": [
              "sample/lib/b.js"
            ]
          },
          "sample/lib/a.js": {
            "isBase": false,
            "name": "sample/lib/a.js",
            "modules": [
              "sample/lib/has-only-one-dependency.js",
              "sample/lib/e.js",
              "sample/lib/a.js"
            ]
          },
          "sample/lib/no-deps.js": {
            "isBase": false,
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

    jsonEqual(t, makeVariableFileNamesConsistent(flags), [
      "--compilation_level", "ADVANCED",
      "--create_source_map", "%outname%.map",
      "--externs", "$splittable.extern.js",
      "--language_in", "ES6",
      "--language_out", "ES5",
      "--module_output_path_prefix", "out/",
      "--new_type_inf", true,
      "--process_common_js_modules", true,
      "--rewrite_polyfills", true,
      "--js", "sample/lib/d.js",
      "--js", "sample/lib/c.js",
      "--js", "sample/lib/b.js",
      "--module", "sample-lib-b:3",
    ]);
  });
});

function makeVariableFileNamesConsistent(flagsArray) {
  for (var i = 0; i < flagsArray.length; i++) {
    if (/splittable\.extern\.js$/.test(flagsArray[i])) {
      flagsArray[i] = '$splittable.extern.js';
    }
    if (/splittable-build\/tmp-/.test(flagsArray[i])) {
      flagsArray[i] = '$TMP_FILE';
    }
  }
  return flagsArray;
}
