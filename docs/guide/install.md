# Install

Install Pyrola from source for the alpha. Requirements: **Node.js** matching the repo `.nvmrc` (currently 26.7.0), **npm**, and a **Rust** toolchain for the Tauri shell.

## Install from source

- Clone the repository into a local directory: `git clone https://github.com/aidanhibbard/pyrola.git`
- Enter the repository root with `cd pyrola`.
- Install dependencies with `npm ci` (or `npm install`).
- Start the desktop app with `npm run tauri dev`.

The Vite frontend alone (`npm run dev`) is limited without Tauri APIs. Prefer `npm run tauri dev` for a real Agents UI session.

## Build a release binary

- Install dependencies with `npm ci` if you have not already.
- Build the desktop app with `npm run tauri build`.
- Locate the platform bundle under `src-tauri/target/release/bundle/`.

On macOS the binary is typically:

`src-tauri/target/release/bundle/macos/pyrola.app/Contents/MacOS/pyrola`

## Install a `pyrola` CLI on your PATH

- Build a release binary with `npm run tauri build`.
- Symlink the binary onto your PATH so `pyrola` resolves in a shell.

Example on macOS:

```sh
ln -s "/path/to/pyrola.app/Contents/MacOS/pyrola" ~/.local/bin/pyrola
```

Without a PATH install on macOS:

```sh
open -a pyrola --args /path/to/repo
```

## Verify the install

- Run `npm run tauri dev` and confirm the Pyrola window opens.
- Open Settings and confirm the Providers section loads.
- Follow [Getting started](./getting-started.md) to add a key and start a chat.

## Related

- [CLI](./cli.md)
- [Getting started](./getting-started.md)
- [Contributing](https://github.com/aidanhibbard/pyrola/blob/main/CONTRIBUTING.md)
