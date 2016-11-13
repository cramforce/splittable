#!/usr/bin/env node
/*
 * Copyright 2016 The Closure Compiler Authors.
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

var ClosureCompiler = require('google-closure-compiler').compiler;
var Promise = require('bluebird');
var babel = require('babelify');
var browserify = require('browserify');
var through = require('through2');
var devnull = require('dev-null');
const TopologicalSort = require('topological-sort');

module.exports = function(config, on) {
  // Reasonable defaults.
  var flags = {
    compilation_level: 'ADVANCED',
    process_common_js_modules: true,
    rewrite_polyfills: true,
    create_source_map: '%outname%.map',
    new_type_inf: true,
    language_in: 'ES6',
    language_out: 'ES5',
    module_output_path_prefix: config.writeTo || 'out/',
    output_module_dependencies: './modules.json',
  };
  if (config.flags) {
    Object.assign(flags, config.flags);
  }

  var flagsArray = [];
  for (var flag in flags) {
    flagsArray.push('--' + flag, flags[flag]);
  }

  console.log('entry', config.modules);
  return getGraph(config.modules).then(function(g) {
    console.log(JSON.stringify(g, undefined, '  '));

    // Build up the weird flag structure that closure compiler calls
    // modules and we call bundles.
    for (var name in g.bundles) {
      var bundle = g.bundles[name];
      // In each bundle, first list JS files that belong into it.
      bundle.modules.reverse().forEach(function(js) {
        if (!js.endsWith('.js')) {
          js += '.js';
        }
        flagsArray.push('--js', js);
      });
      // Mangle the name. This should be more robust eventually.
      var name = bundle.name
          .replace(process.cwd() + '/', '')
          .replace(/\//g, '-');
      // And now build --module $name:$numberOfJsFiles:$bundleDeps
      var cmd = name + ':' + bundle.modules.length;
      // All non _base bundles depend on _base.
      if (name != '_base') {
        cmd += ':_base';
      }
      flagsArray.push('--module', cmd);
    }

    // Compile.
    return new Promise(function(resolve, reject) {
      new ClosureCompiler(flagsArray).run(function(exitCode, stdOut, stdErr) {
        console.info(stdOut);
        console.error(stdErr);
        if (exitCode == 0) {
          resolve();
        } else {
          reject();
        }
      });
    })
  });
};

// Produces a graph based on the dependencies of the entry modules.
function getGraph(entries) {
  var resolve;
  var reject;
  var promise = new Promise(function(res, rej) {
    resolve = res;
    reject = rej;
  });
  var topo = new TopologicalSort({});
  var graph = {
    // Lookup whether a module is a dep of a given entry module
    depOf: {},
    // Map of module id to its deps array.
    deps: {},
    // Topological sorted array of all deps.
    sorted: undefined,
    // Generated bundles
    bundles: {
      // We always have a _base bundle.
      _base: {
        name: '_base',
        // The modules in the bundle.
        modules: [],
      },
    },
  };
  var edges = {};

  // Use browserify with babel to learn about deps.
  var b = browserify(entries, {debug: true, deps: true})
      .transform(babel, {presets: ["es2015"]});
  // This gets us the actual deps.
  b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
    topo.addNode(row.id, row.id);
    console.log(row.id, row);
    var deps = edges[row.id] = Object.keys(row.deps).map(function(i) {
      return row.deps[i];
    });
    graph.deps[row.id] = deps;
    if (row.entry) {
      graph.depOf[row.id] = {};
      graph.depOf[row.id][row.id] = true;  // Self edge.
      deps.forEach(function(dep) {
        graph.depOf[row.id][dep] = true;
      })
    }
    next();
  }));
  b.bundle().on('end', function() {
    for (var id in edges) {
      edges[id].forEach(function(dep) {
        console.log('edge', id, dep);
        topo.addEdge(id, dep);
      })
    }
    console.log(topo.sort());
    graph.sorted = Array.from(topo.sort().keys());

    // For each module, mark them as to whether any of the entry
    // modules depends on them (transitively).
    graph.sorted.forEach(function(id) {
      graph.deps[id].forEach(function(dep) {
        for (var entry in graph.depOf) {
          if (graph.depOf[entry][id]) {
            graph.depOf[entry][dep] = true;
          }
        }
      });
    });

    // Create the bundles.
    graph.sorted.forEach(function(id) {
      var inBundleCount = 0;
      // The bundle a module should go into.
      var dest;
      // Count in how many bundles a modules wants to be.
      for (var entry in graph.depOf) {
        if (graph.depOf[entry][id]) {
          inBundleCount++;
          dest = entry;
        }
      }
      console.assert(inBundleCount >= 1,
          'Should be in at least 1 bundle', id);
      // If a module is in more than 1 bundle, it must go into _base.
      if (inBundleCount > 1) {
        dest = '_base';
      }
      if (!graph.bundles[dest]) {
        graph.bundles[dest] = {
          name: dest,
          modules: [],
        };
      }
      graph.bundles[dest].modules.push(id);
    });

    resolve(graph);
  }).on('error', reject).pipe(devnull());
  return promise;
}
