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
var maybeAddDotJs = require('../splittable').maybeAddDotJs;
var splittable = require('../splittable');

function jsonEqual(t, a, b, message) {
  t.equal(
      stringify(a, {space: 0}),
      stringify(b, {space: 0}),
      message);
}

t.test('module order with 2 modules', function(t) {
  return getGraph(['./sample/lib/a', './sample/lib/b'], {}).then(function(g) {
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
          "sample/lib/data.json",
          "sample/lib/a.js"
        ]
      }
    });

    jsonEqual(t, makeVariableFileNamesConsistent(getBundleFlags(g)), [
      "--js", "base.js",
      "--js", "./splittable-build/transformed/sample/lib/d.js",
      "--js", "./splittable-build/transformed/sample/lib/c.js",
      "--module", "_base:3",
      "--module_wrapper", "_base:" + splittable.baseBundleWrapper,
      "--js", "./splittable-build/transformed/sample/lib/has-only-one-dependency.js",
      "--js", "./splittable-build/transformed/sample/lib/e.js",
      "--js", "sample/lib/data.json",
      "--js", "./splittable-build/transformed/sample/lib/a.js",
      "--js", "$TMP_FILE",
      "--module", "sample-lib-a:5:_base",
      "--module_wrapper", "sample-lib-a:" + splittable.bundleWrapper,
      "--js", "./splittable-build/transformed/sample/lib/b.js",
      "--js", "$TMP_FILE",
      "--module", "sample-lib-b:2:_base",
      "--module_wrapper", "sample-lib-b:" + splittable.bundleWrapper,
      "--js_module_root", "./splittable-build/transformed/",
      "--js_module_root", "./splittable-build/browser/",
      "--js_module_root", "./",
    ]);
  });
});

t.test('module order with 2 modules and no overlap', function(t) {
  return getGraph(['./sample/lib/d', './sample/lib/e'], {}).then(function(g) {
    jsonEqual(t, g.bundles, {
      "_base": {
        "isBase": true,
        "name": "_base",
        "modules": []
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
  return getGraph(['sample/lib/b.js'], {}).then(function(g) {
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
      "--js", "base.js",
      "--js", "./splittable-build/transformed/sample/lib/d.js",
      "--js", "./splittable-build/transformed/sample/lib/c.js",
      "--js", "./splittable-build/transformed/sample/lib/b.js",
      "--module", "sample-lib-b:4",
      "--module_wrapper", "sample-lib-b:" + splittable.defaultWrapper,
      "--js_module_root", "./splittable-build/transformed/",
      "--js_module_root", "./splittable-build/browser/",
      "--js_module_root", "./"
    ]);
  });
});

t.test('packages', function(t) {
  return getGraph(['sample/lib/other-module-root'], {}).then(function(g) {
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
      "--js", "base.js",
      "--js", "node_modules/d3-array/build/d3-array.js",
      "--js", "node_modules/d3-path/build/d3-path.js",
      "--js", "node_modules/d3-shape/build/d3-shape.js",
      "--js", "node_modules/left-pad/index.js",
      "--js", "node_modules/promise-pjs/promise.js",
      "--js", "./splittable-build/transformed/sample/lib/other-module-root.js",
      "--module", "sample-lib-other-module-root:12",
      "--module_wrapper", "sample-lib-other-module-root:" +
          splittable.defaultWrapper,
      "--js_module_root", "./splittable-build/transformed/",
      "--js_module_root", "./splittable-build/browser/",
      "--js_module_root", "./",
    ]);
  });
});

t.test('module order with 3 modules', function(t) {
  return getGraph(['./sample/lib/a', './sample/lib/b',
      './sample/lib/no-deps'], {}).then(function(g) {
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
              "sample/lib/data.json",
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
      "--apply_input_source_maps", true,
      "--compilation_level", "ADVANCED",
      "--create_source_map", "%outname%.map",
      "--externs", "$splittable.extern.js",
      "--jscomp_off", "accessControls",
      "--jscomp_off", "globalThis",
      "--jscomp_off", "misplacedTypeAnnotation",
      "--jscomp_off", "nonStandardJsDocs",
      "--jscomp_off", "suspiciousCode",
      "--jscomp_off", "uselessCode",
      "--language_in", "ES6",
      "--language_out", "ES5",
      "--module_output_path_prefix", "out/",
      "--new_type_inf", true,
      // If files have been pre-transformed we want those source maps
      // to be used for the output sourcemap.
      "--parse_inline_source_maps", true,
      "--process_common_js_modules", true,
      "--rewrite_polyfills", true,
      // For transformed files, we want to point source maps to the originals
      // because the maps actually refer to those.
      "--source_map_location_mapping","splittable-build/transformed/|/",
      "--source_map_location_mapping","splittable-build/browser/|/",
      "--source_map_location_mapping", "|/",
      "--js", "base.js",
      "--js", "./splittable-build/transformed/sample/lib/d.js",
      "--js", "./splittable-build/transformed/sample/lib/c.js",
      "--js", "./splittable-build/transformed/sample/lib/b.js",
      "--module", "sample-lib-b:4",
      "--module_wrapper", "sample-lib-b:" + splittable.defaultWrapper,
      "--js_module_root", "./splittable-build/transformed/",
      "--js_module_root", "./splittable-build/browser/",
      "--js_module_root", "./",
    ]);
  });
});

t.test('maybeAddDotJs', function(t) {
  t.equals('./test.js', maybeAddDotJs('./test.js'));
  t.equals('./test.js', maybeAddDotJs('./test'));
  // Should this happen?
  t.equals('./test.xml.js', maybeAddDotJs('./test.xml'));
  t.equals('./test.JS', maybeAddDotJs('./test.JS'));
  t.equals('./test.json', maybeAddDotJs('./test.json'));
  t.equals('./test.es', maybeAddDotJs('./test.es'));
  t.equals('./test.es6', maybeAddDotJs('./test.es6'));
  t.end();
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
