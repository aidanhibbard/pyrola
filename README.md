# pyrola

## CLI usage

Open Pyrola with an optional project directory. The path is resolved relative to your current working directory when relative.

```sh
pyrola .
pyrola /path/to/repo
```

On first launch with a path, the project is registered in the fleet registry (using the directory name) and set as the active project. If the path is already registered, it is activated.

### Installing a `pyrola` command

After building the app (`npm run tauri build`), symlink or copy the bundled binary onto your `PATH`. On macOS the release binary is typically at `src-tauri/target/release/bundle/macos/pyrola.app/Contents/MacOS/pyrola`.

```sh
ln -s "/path/to/pyrola.app/Contents/MacOS/pyrola" ~/.local/bin/pyrola
```

Without a `PATH` install you can open a project from Terminal on macOS:

```sh
open -a pyrola --args /path/to/repo
```

**Known limitation:** launching `pyrola /path` while Pyrola is already running starts a second instance; single-instance handoff (focus existing window and switch project) is not implemented yet.

---

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
