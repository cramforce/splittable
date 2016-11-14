# Splittable

Splittable is a next-generation module bundler for JavaScript with support for

- super simple **code splitting**.
- **ES6** modules.
- **CommonJS** modules (with some caveats).
- **extremely efficient** packing of modules.
- **dead code elimination** (also sometimes called **tree shaking**).
- **smaller code** for real world projects than all other known module bundlers.

## Usage from the command line

### Installation

`npm i -g splittable`

### Run

`splittable path/to/module1 path/to/module2`

and optionally specify destination directory for bundles

`splittable path/to/module1 path/to/module2 --write-to=dist/`

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

## Isn't this like

- [**Rollup**](http://rollupjs.org/): Yes, but it supports code splitting, CommonJS modules, and significantly more aggressive tree shaking. File sizes should typically be much smaller.
- [**Webpack**](https://webpack.github.io/): Webpack has way bigger scope, but could possibly use Splittable as a plugin. In general, Webpack will generate significantly less efficient and much bigger code.
- [**Browserify**](http://browserify.org/): See Webpack.

This section is for entertainment only. All of the above bundlers certainly have dozens of other features that makes them more useful than splittable and/or could use splittable as plugin to get the best of all worlds.

## How does it work?

Splittable is a wrapper around both browserify, babel and Closure Compiler. It uses the former 2 to resolve modules and their dependencies, and then uses Closure Compiler for efficient compilation of code.

Splittable takes a list of entry modules as its input and then creates bundles for each of them, as well as an additional bundle with the share dependencies.

## How to load splittable bundles

By default bundles are generated into the `out/` directory (can be overridden via `writeTo` option). Load these bundles in your production application.

Splittable currently doesn't come with a built-in code loader.

Loading bundles should be easy, though:

- Always load the `_base.js` bundle first or inline it into your initial page response.
- Then load whatever other bundle you need via injected script tags.
