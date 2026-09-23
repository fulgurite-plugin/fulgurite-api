# Fulgurite plugin API

Type definitions for Fulgurite plugins ([`index.d.ts`](index.d.ts)), and how a plugin is made, packaged and published.

Plugins are TypeScript that runs inside the app's core (QuickJS). They never draw UI themselves: they register
commands (the ⌘P palette), listen to events, extend the editor (keys, the status line, syntax styles), read and write
notes, and declare options that the app draws in Settings. The same bundle runs on the Mac, iPhone and iPad. The API is
shaped after Obsidian's; packaging and publishing follow Inkdrop's.

The official plugins in this organization are complete examples:
[vim](https://github.com/Fulgurite-Plugin/vim) · [emoji](https://github.com/Fulgurite-Plugin/emoji) ·
[math](https://github.com/Fulgurite-Plugin/math) · [templates](https://github.com/Fulgurite-Plugin/templates) ·
[tables](https://github.com/Fulgurite-Plugin/tables)

## A plugin is a repository

```
package.json    the manifest
src/main.ts     the plugin
main.js         the built bundle, committed: it is what the app downloads
```

### package.json

```json
{
  "name": "someone.hello",
  "displayName": "Hello",
  "version": "0.1.0",
  "description": "Says hello",
  "repository": "https://github.com/someone/hello",
  "main": "main.js",
  "isDesktopOnly": false,
  "private": true,
  "scripts": {
    "build": "esbuild src/main.ts --bundle --format=iife --global-name=__plugin --target=es2022 --outfile=main.js",
    "check": "tsc --noEmit",
    "preversion": "npm run check",
    "version": "npm run build && git add main.js",
    "postversion": "git push --follow-tags"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "fulgurite": "github:Fulgurite-Plugin/api#v0.1.0",
    "typescript": "^5.6.0"
  }
}
```

- `name` is the plugin's id: lowercase letters, digits, `.` `_` `-`. Its commands are `<id>:<command>`, and the app
  keeps its options and data under it.
- `displayName` is what Settings shows.
- `isDesktopOnly`: true when the plugin can't work on a phone or tablet. iPhone and iPad then don't offer it.
- The bundle must be an esbuild IIFE with `--global-name=__plugin` whose default export is the plugin (the `build`
  script above).

### src/main.ts

```ts
import type { Plugin } from "fulgurite"

const plugin: Plugin = {
  onLoad(ctx) {
    ctx.commands.add({ id: "hello", name: "Say hello", callback: () => ctx.notice("Hello") })
  },
}

export default plugin
```

Everything registered through `ctx` is released when the plugin is switched off or uninstalled. `index.d.ts` documents
the whole API.

## Develop

```sh
npm install
npm run build     # main.js
npm run check     # types
```

To try it in the app, put the plugin's folder (or a symlink to it) in the app's plugins folder, named after its id,
and relaunch the app:

```sh
ln -s "$PWD" ~/.config/fulgurite/plugins/someone.hello
```

On iPhone and iPad the plugins folder is Files › Fulgurite › plugins.

## Publish

Like Inkdrop's `ipm publish`, one command:

```sh
npm version patch     # or minor, major
```

It type-checks, bumps the version, builds main.js, commits, tags `v<version>` and pushes. The app installs the release
that the default branch's package.json names, from that tag, and offers it as an update to people with an older one.

To list a new plugin in Settings › Plugins, add its repository to
[registry](https://github.com/Fulgurite-Plugin/registry)'s `plugins.json` in a pull request. Plugins in this
organization are marked Official.
