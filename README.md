# Splittable

Splittable is a next-generation module bundler for JavaScript with support for

- super simple **code splitting**.
- **ES6** modules.
- **CommonJS** modules (with some caveats).
- **extremely efficient** packing of modules.
- **dead code elimination** (also sometimes called **tree shaking**).
- **smaller code** for real world projects than all other known module bundlers.

## Usage from the command line

Requires java for one dependency to run.

### Installation

`npm i -g splittable`

### Run

`splittable path/to/module1.js path/to/module2.js`

and optionally specify destination directory for bundles

`splittable path/to/module1.js path/to/module2.js --write-to=dist/`

## Usage from JS

```js

var splittable = require('splittable');

splittable({
  // Create bundles from 2 entry modules `./lib/a` and `./lib/b`.
  modules: ['./lib/a', './lib/b'],
  writeTo: 'out/',
}).then(function(info) {
  console.info('Compilation successful');
  if (info.warnings) {
    console.warn(info.warnings);
  }
}, function(reason) {
  console.error('Compilation failed', reason);
});

```

The above will write 3 files (plus sourcemaps) to the directory `out`.

1. A bundle of `./lib/a` and its dependencies.
2. A bundle of `./lib/b` and its dependencies.
3. A bundle called `_base.js` that contains the shared dependencies of the entry modules.

## Loading splittable bundles

By default bundles are generated into the `out/` directory (can be overridden via `writeTo` option).

### `System.import`

The generated `_base.js` bundle ships with a [`System.import`](http://exploringjs.com/es6/ch_modules.html#_loader-method-importing-modules) polyfill. It can be used to load modules exposed as bundles via splittable.

```
System.baseURL = '/path/to/bundles/';
System.import('module/path').then(function(module) {
  module.exportedFunction();
})
```

`module/path` must be a path to a module as used in your splittable command line config or JS calls. It is **not** a relative path with respect to the actual JS module you call this from.

`System.baseURL = '/path/to/bundles/';` must be supplied, so the loader knows where to find the bundles. This should be the directory, where you deployed your splittable bundles.

### Via async script tags

Loading splittable bundles is super straightforward with `async` script tags. You do not need to worry about the order in which they execute. Example:

```html
<script async src="out/_base.js"></script>
<script async src="out/lib-a.js"></script>
<script async src="out/lib-b.js"></script>
```

For an example and advanced usage such as JS initiated loading see the [sample](sample/load-sample.html).

## Isn't this like

- [**Rollup**](http://rollupjs.org/): Yes, but it supports code splitting, CommonJS modules, and significantly more aggressive tree shaking. File sizes should typically be much smaller.
- [**Webpack**](https://webpack.github.io/): Webpack has way bigger scope, but could possibly use Splittable as a plugin. In general, Webpack will generate significantly less efficient and much bigger code. It does, however, support multiple layers of bundle dependencies which will often result in smaller portions of the application being downloaded in initial bundles. It also has way more features, though, and is more mature, so may still be a win.
- [**Browserify**](http://browserify.org/): Similar to Webpack, browserify generates less efficient code and comes with an awesome ecosystem of plugins.

This section is for entertainment only. All of the above bundlers certainly have dozens of other features that makes them more useful than splittable and/or could use splittable as plugin to get the best of all worlds.

## How does it work?

Splittable is a wrapper around both [**Browserify**](http://browserify.org/), [Babel](https://babeljs.io/) and [Closure Compiler](https://github.com/google/closure-compiler). It uses the former 2 to resolve modules and their dependencies, and then uses Closure Compiler for efficient compilation of code.

Splittable takes a list of entry modules as its input and then creates bundles for each of them, as well as an additional bundle with the share dependencies.

## Possible improvements

- Splittable currently pollutes the global scope with lots of symbols, so that they are visible across modules. This could be fixed with `--rename_prefix_namespace` at the trade off of slightly more verbose generated code.
- Splittable only supports one layer of bundle hierarchy. This can lead to an extremely bloated base bundle. Multiple layers could be supported at the price of greater complexity in several dimensions.
- Switch Closure Compiler to the JS-only version (cut Java dependency). This requires adding support for code splitting to the JS version.

