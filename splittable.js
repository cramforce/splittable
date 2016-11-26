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
var path = require('path');
var fs = require('fs');
var findPackageJsonPath = require('find-root');
const TopologicalSort = require('topological-sort');

// Override to local closure compiler JAR
ClosureCompiler.JAR_PATH = require.resolve(
    './third_party/closure-compiler/closure-compiler-1.0-SNAPSHOT.jar');

exports.splittable = function(config) {

  if (!config || !config.modules) {
    return Promise.reject(
        new Error('Pass an array of entry modules via modules option. ' +
            'Example: {modules: ["./first", "./second"]}'));
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
    externs: path.dirname(module.filename) + '/splittable.extern.js',
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

  // Write all the packages (directories with a package.json) as --js
  // inputs to the flags. Closure compiler reads the packages to resolve
  // non-relative module names.
  var packageCount = 0;
  Object.keys(g.packages).sort().forEach(function(package) {
    flagsArray.push('--js', package);
    packageCount++;
  });
  // Build up the weird flag structure that closure compiler calls
  // modules and we call bundles.
  var bundleKeys = Object.keys(g.bundles);
  bundleKeys.sort().forEach(function(name) {
    var isBase = name == '_base';
    var extraModules = 0;
    var bundle = g.bundles[name];
    // In each bundle, first list JS files that belong into it.
    bundle.modules.forEach(function(js) {
      flagsArray.push('--js', js);
    });
    if (!isBase && bundleKeys.length > 1) {
      flagsArray.push('--js', bundleTrailModule(bundle.name));
      extraModules++;
    }
    // The packages count as inputs to the first module.
    if (packageCount) {
      extraModules += packageCount;
      packageCount = 0;
    }
    // Replace directory separator with - in bundle filename
    var name = bundle.name
        .replace(/\.js$/g, '')
        .replace(/[\/\\]/g, '-');
    // And now build --module $name:$numberOfJsFiles:$bundleDeps
    var cmd = name + ':' + (bundle.modules.length + extraModules);
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
    packages: {},
  };

  // Use browserify with babel to learn about deps.
  var b = browserify(entryModules, {debug: true, deps: true})
      .transform(babel, {plugins: [require.resolve("babel-plugin-transform-es2015-modules-commonjs")]});
  // This gets us the actual deps. We collect them in an array, so
  // we can sort them prior to building the dep tree. Otherwise the tree
  // will not be stable.
  var depEntries = [];
  b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
    row.source = null;  // Release memory
    depEntries.push(row);
    next();
  }));

  b.bundle().on('end', function() {
    var edges = {};
    depEntries.sort(function(a, b) {
      return a.id < b.id;
    }).forEach(function(row) {
      var id = unifyPath(maybeAddDotJs(relativePath(process.cwd(), row.id)));
      topo.addNode(id, id);
      var deps = edges[id] = Object.keys(row.deps).sort().map(function(dep) {
        var depId = row.deps[dep];
        var relPathtoDep = unifyPath(relativePath(process.cwd(), row.deps[dep]));

        // Non relative module path. Find the package.json.
        if (!/^\./.test(dep)) {
          var packageJson = findPackageJson(depId);
          if (packageJson) {
            graph.packages[packageJson] = true;
          }
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
    });
    Object.keys(edges).sort().forEach(function(id) {
      edges[id].forEach(function(dep) {
        topo.addEdge(id, dep);
      })
    });
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
      Object.keys(graph.depOf).sort().forEach(function(entry) {
        if (graph.depOf[entry][id]) {
          graph.depOf[entry][dep] = true;
        }
      });
    });
  });

  // Create the bundles.
  graph.sorted.forEach(function(id) {
    var inBundleCount = 0;
    // The bundle a module should go into.
    var dest;
    // Count in how many bundles a modules wants to be.
    Object.keys(graph.depOf).sort().forEach(function(entry) {
      if (graph.depOf[entry][id]) {
        inBundleCount++;
        dest = entry;
      }
    })
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

function bundleTrailModule(name) {
  if (!fs.existsSync('./splittable-build')) {
    fs.mkdirSync('./splittable-build');
  }
  var tmp = require('tmp').fileSync({
    template: './splittable-build/tmp-XXXXXX.js'
  });

  var js = '// Generated code to get module ' + name + '\n' +
      '(self["_S"]=self["_S"]||[])["//' + name + '"]=' +
      'require("' + relativePath(path.dirname(tmp.name), name) + '")\n';
  fs.writeFileSync(tmp.name, js, 'utf8');
  return relativePath(process.cwd(), tmp.name);
}

function unifyPath(id) {
  return id.split(path.sep).join('/');
}

/**
 * Given a module path, return the path to the relevant package.json or
 * null. Returns null if the module is not inside a node_modules directory.
 * @return {?string}
 */
function findPackageJson(modulePath) {
  if (modulePath.split(path.sep).indexOf('node_modules') == -1) {
    return null;
  }
  return relativePath(process.cwd(),
      findPackageJsonPath(modulePath) + '/package.json');
}

var systemImport =
    // Polyfill and/or monkey patch System.import.
    '(self.System=self.System||{}).import=function(n){' +
    'n=n.replace(/\\.js$/g,"")+".js";' +
    'return (self._S["//"+n]&&Promise.resolve(self._S["//"+n]))' +
    '||self._S[n]||(self._S[n]=new Promise(function(r,t){' +
    'var s=document.createElement("script");' +
    's.src=(self.System.baseURL||".")+"/"+n.replace(/[\\/\\\\]/g,"-");' +
    's.onerror=t;s.onload=function(){r(self._S["//"+n])};' +
    '(document.head||document.documentElement).appendChild(s);' +
    '})' +
    ')};\n';

// Don't wrap the bundle itself in a closure (other bundles need
// to be able to see it), but add a little async executor for
// scheduled functions.
exports.baseBundleWrapper =
    '%s\n' +
    systemImport +
    '(self._S=self._S||[]).push=function(f){f.call(self)};' +
    '(function(f){while(f=self._S.shift()){f.call(self)}})();\n' +
    '//# sourceMappingURL=%basename%.map\n';

// Schedule or execute bundle via _S global.
exports.bundleWrapper =
    '(self._S=self._S||[]).push((function(){%s}));\n' +
    '//# sourceMappingURL=%basename%.map\n';
