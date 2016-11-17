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

var ClosureCompiler = require('google-closure-compiler').compiler;
var Promise = require('bluebird');
var babel = require('babelify');
var browserify = require('browserify');
var through = require('through2');
var devnull = require('dev-null');
var relativePath = require('path').relative;
var path = require('path')
const TopologicalSort = require('topological-sort');

exports.splittable = function(config) {

  if (!config || !config.modules) {
    return Promise.reject(
        new Error('Pass an array of entry modules via modules option. ' +
            'Example: {modules: ["./first", "./secomd"]}'));
  }

  return exports.getFlags(config).then(function(flagsArray) {
    return new Promise(function(resolve, reject) {
      new ClosureCompiler(flagsArray).run(function(exitCode, stdOut, stdErr) {
        if (exitCode == 0) {
          resolve({
            warnings: stdErr,
          });
        } else {
          reject(
              new Error('Closure compiler compilation of bundles failed.\n' +
                  stdOut + '\n' +
                  stdErr));
        }
      });
    })
  });
};


exports.getFlags = function(config) {
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
  };

  // Turn object into deterministically sorted array.
  var flagsArray = [];
  Object.keys(flags).sort().forEach(function(flag) {
    flagsArray.push('--' + flag, flags[flag]);
  });

  return exports.getGraph(config.modules).then(function(g) {
    return flagsArray.concat(
        exports.getBundleFlags(g, flagsArray));
  });
};

exports.getBundleFlags = function(g) {
  var flagsArray = [];
  // Build up the weird flag structure that closure compiler calls
  // modules and we call bundles.
  var bundleKeys = Object.keys(g.bundles);
  bundleKeys.sort().forEach(function(name) {
    var isBase = name == '_base';
    var bundle = g.bundles[name];
    // In each bundle, first list JS files that belong into it.
    bundle.modules.forEach(function(js) {
      flagsArray.push('--js', js);
    });
    // Replace directory separator with - in bundle filename
    var name = bundle.name
        .replace(/\.js$/g, '')
        .replace(/[\/\\]/g, '-');
    // And now build --module $name:$numberOfJsFiles:$bundleDeps
    var cmd = name + ':' + bundle.modules.length;
    // All non _base bundles depend on _base.
    if (!isBase && g.bundles._base) {
      cmd += ':_base';
    }
    flagsArray.push('--module', cmd);
    if (bundleKeys.length > 1) {
      if (isBase) {
        flagsArray.push('--module_wrapper', name + ':' +
            exports.baseBundleWrapper);
      } else {
        flagsArray.push('--module_wrapper', name + ':' +
            exports.bundleWrapper);
      }
    }
  });
  Object.keys(g.moduleRoots).sort().reverse().forEach(function(root) {
    flagsArray.push('--js_module_root', root);
  })
  return flagsArray;
}

/**
 * Produces a graph based on the dependencies of the entry modules.
 * @param {!Array<string>} entryModules
 * @return {!Promise<{bundles: !Object}>} A Promise for bundle definitions.
 * @visibleForTesting
 */
exports.getGraph = function(entryModules) {
  var resolve;
  var reject;
  var promise = new Promise(function(res, rej) {
    resolve = res;
    reject = rej;
  });
  var topo = new TopologicalSort({});
  var graph = {
    entryModules: entryModules,
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
        isBase: true,
        name: '_base',
        // The modules in the bundle.
        modules: [],
      },
    },
    moduleRoots: {},
  };
  var edges = {};

  // Use browserify with babel to learn about deps.
  var b = browserify(entryModules, {debug: true, deps: true})
      .transform(babel, {plugins: [require.resolve("babel-plugin-transform-es2015-modules-commonjs")]});
  // This gets us the actual deps.
  b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
    var id = maybeAddDotJs(relativePath(process.cwd(), row.id));
    topo.addNode(id, id);
    var deps = edges[id] = Object.keys(row.deps).map(function(dep) {
      var depId = row.deps[dep];
      var relPathtoDep = relativePath(process.cwd(), row.deps[dep]);

      // Non relative module path. Try to find module root.
      if (!/^\./.test(dep)) {
        var moduleRoot = path.dirname(relPathtoDep);
        // Index path can be resolved by CC, so go one level up.
        if (relPathtoDep.endsWith('index')
            || relPathtoDep.endsWith('index.js')) {
          moduleRoot = path.dirname(moduleRoot);
        }
        // Go on level up per dir in module name.
        var dirCount = dep.split(/\//);
        for (var i = 0; i < dirCount; i++) {
          moduleRoot = path.dirname(moduleRoot);
        }
        graph.moduleRoots[moduleRoot] = true;
      }
      return relPathtoDep;
    });
    graph.deps[id] = deps;
    if (row.entry) {
      graph.depOf[id] = {};
      graph.depOf[id][id] = true;  // Self edge.
      deps.forEach(function(dep) {
        graph.depOf[id][dep] = true;
      })
    }
    next();
  }));
  b.bundle().on('end', function() {
    for (var id in edges) {
      edges[id].forEach(function(dep) {
        topo.addEdge(id, dep);
      })
    }
    graph.sorted = Array.from(topo.sort().keys()).reverse();

    setupBundles(graph);

    resolve(graph);
  }).on('error', reject).pipe(devnull());
  return promise;
}

function setupBundles(graph) {
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
        isBase: false,
        name: dest,
        modules: [],
      };
    }
    graph.bundles[dest].modules.push(id);
  });

  // No need for a base module if there was only one entry module.
  if (graph.entryModules.length == 1) {
    delete graph.bundles._base;
  }
}

function maybeAddDotJs(id) {
  if (!id.endsWith('.js')) {
    id += '.js'
  }
  return id;
}

// Don't wrap the bundle itself in a closure (other bundles need
// to be able to see it), but add a little async executor for
// scheduled functions.
exports.baseBundleWrapper =
    '%s\n(self._S=self._S||[]).push=function(f){f.call(self)};' +
    '(function(f){while(f=self._S.shift()){f.call(self)}})();\n' +
    '//# sourceMappingURL=%basename%.map\n';

// Schedule or execute bundle via _S global.
exports.bundleWrapper =
    '(self._S=self._S||[]).push((function(){%s}));\n' +
    '//# sourceMappingURL=%basename%.map\n';
