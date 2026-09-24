// Fulgurite plugin API. Plugins run inside the Rust core (QuickJS) and never draw platform UI themselves: they
// register commands, listen to events, extend the editor, read and write notes, and declare options; every shell
// draws the result (the command palette, a settings pane, notices). The same bundle runs on the Mac, iPhone and iPad
// today and on every platform the core runs on later. Shaped after Obsidian's plugin API wherever it fits.
//
// A plugin is a GitHub repository, packaged like an Inkdrop plugin (see README.md):
//   package.json  the manifest: `name` (the plugin id, e.g. "fulgurite.vim"), `displayName`, `version`, `description`,
//                 `repository` (its GitHub URL), `isDesktopOnly` (Obsidian's flag: true when it can't work on a phone
//                 or tablet; iPhone and iPad then never load it)
//   main.js       the built bundle: `esbuild src/main.ts --bundle --format=iife --global-name=__plugin`, whose default
//                 export is a `Plugin`
// A release is the git tag `v<version>`; the app installs the one the default branch's package.json names.

export interface Disposable {
  dispose(): void
}

export interface Plugin {
  /** Everything registered through `ctx` is disposed automatically on unload. Return extra disposables for anything else you hold. */
  onLoad(ctx: PluginContext): Disposable[] | void
  /** Obsidian's `onunload`: runs after everything registered through `ctx` has been disposed. */
  onUnload?(): void
  /** A hand-edited config file, the way Obsidian's vimrc plugin reads `.obsidian.vimrc`. The app keeps it in its config
   *  folder (`~/.config/fulgurite/<name>` on the Mac, the app's folder in Files on iOS), creates it from `template` the
   *  first time the person edits it, offers "Edit <name>…" in the plugin's settings, and passes its text to
   *  `onConfig` when the plugin loads and whenever the file is saved. */
  configFile?: { name: string; template?: string }
  /** The config file's text (see `configFile`): after `onLoad`, and again whenever the file is saved. */
  onConfig?(text: string): void
}

export interface PluginContext {
  commands: Commands
  events: Events
  editor: Editor
  /** The notes, like Obsidian's `app.vault`. */
  notes: Notes
  /** Options the app draws in the plugin's settings pane, like Obsidian's `addSettingTab`. */
  settings: Settings
  /** Obsidian's `loadData`/`saveData`: one JSON value per plugin, kept by the app on this device. */
  data: PluginData
  /** A short message the app shows for a few seconds, like Obsidian's `new Notice()`. */
  notice(message: string): void
  /** What the app draws for a plugin: pickers. */
  ui: UI
  /** The app's template engine, the same one MCP agents use. */
  templates: Templates
}

// MARK: - Templates

export interface Templates {
  /** The templates: the notes in the Templates workspace (the Templates plugin's option), by title. null when that
   *  workspace doesn't exist. */
  list(): NoteInfo[] | null
  /** Fills `text`: {{date}} {{time}} {{date:FORMAT}} {{time:FORMAT}} with now (moment tokens; formats from the Templates
   *  options), {{title}} {{url}} and any {{name}} from `values` ({{domain}} comes from url), {{"a prompt"}} from `values`
   *  keyed by the prompt's text. Anything without a value stays as written. */
  fill(text: string, values?: Record<string, string>): string
}

// MARK: - UI

export interface SuggestItem {
  /** Handed back to `onChoose`. Not empty. */
  id: string
  /** What the list shows and typing filters. */
  label: string
  /** A second, muted line. */
  detail?: string
}

export interface UI {
  /** Obsidian's `SuggestModal`: the app shows `items` in a palette-style picker (typing filters them) once the current
   *  key or command is done, and runs `onChoose` with the chosen item's id and the open note's view (edits apply as
   *  usual). Dismissed: nothing runs. One picker at a time; a new one replaces the last. */
  suggest(options: { placeholder?: string; items: SuggestItem[] }, onChoose: (id: string, view: EditorView) => void): void
}

// MARK: - Commands

/** Listed in the command palette (⌘P) under `name`, runnable from a vimrc mapping (`:<full id>`) and by other plugins. */
export interface Command {
  /** Unique within the plugin. The full id is `<plugin id>:<id>`, as in Obsidian. */
  id: string
  name: string
  /** Runs against the open note; the palette offers the command only while a note is open. */
  editorCallback?(view: EditorView): void
  /** Runs anywhere. */
  callback?(): void
}

export interface Commands {
  /** Obsidian's `addCommand`. */
  add(command: Command): Disposable
  /** Runs a plugin command (`<plugin id>:<id>`) or one of the app's, which the shell carries out:
   *  `note.new` `note.save` `note.close` `note.goto` (the [[link]] under the cursor) `note.open` (arg: note id)
   *  `block.open` (edits the code block at the arg offset, or at the cursor, in its page: `Editor.registerCodeBlock`)
   *  `workspace.new` `search.all` `search.titles` `find.inNote` `find.next` `find.previous` `edit.undo` `edit.redo`
   *  `edit.scroll` (arg: `<offset> <top|center|bottom>`, puts the line holding the offset there; the cursor stays on
   *  screen) `palette.open` `view.toggleSidebar` `view.toggleNoteList` `sync.now`. */
  execute(id: string, arg?: string): void
}

// MARK: - Events

/** From the app: `buffer.opened` {noteId} (a note was loaded into the editor), `note.saved` {noteId},
 *  `note.deleted` {noteId}. Plugins may emit their own. */
export interface Events {
  on(name: string, handler: (payload?: unknown) => void): Disposable
  emit(name: string, payload?: unknown): void
}

// MARK: - Notes

export interface NoteInfo {
  id: string
  title: string
  body: string
  /** Derived from `#tags` in the body. */
  tags: string[]
  /** Derived from `[[links]]` in the body. */
  links: string[]
  workspaceId: string | null
  /** Unix milliseconds. */
  createdAt: number
  updatedAt: number
}

export interface Notes {
  /** The note open in the editor, its body as it is on screen (saved or not). */
  current(): NoteInfo | null
  get(id: string): NoteInfo | null
  /** Case-insensitive; the most recently edited one when titles repeat (how `[[links]]` resolve). */
  byTitle(title: string): NoteInfo | null
  /** Newest first. */
  list(filter?: { tag?: string; workspaceId?: string }): NoteInfo[]
  create(note: { title: string; body?: string; workspaceId?: string | null }): NoteInfo
  /** Changes a stored note; it syncs like any edit. For the open note's text, prefer the editor view: its edits undo. */
  update(id: string, change: { title?: string; body?: string; workspaceId?: string | null }): NoteInfo
  /** Shows a note in the editor. */
  open(id: string): void
  /** The workspaces (note groups), like Obsidian's folders. */
  workspaces(): WorkspaceInfo[]
}

export interface WorkspaceInfo {
  id: string
  name: string
}

// MARK: - Settings and data

interface SettingBase {
  key: string
  name: string
  description?: string
}

/** One option in the plugin's settings pane. Values are stored by the app and survive restarts. */
export type SettingItem =
  | (SettingBase & { type: "toggle"; default: boolean })
  | (SettingBase & { type: "text"; default: string; placeholder?: string })
  | (SettingBase & { type: "number"; default: number; min: number; max: number; step?: number })
  | (SettingBase & { type: "dropdown"; default: string; options: Record<string, string> })

export interface Settings {
  /** Declares the options; `onChange` hears every change the person makes, with all current values. */
  define(items: SettingItem[], onChange?: (values: Record<string, unknown>) => void): Disposable
  /** Current values, defaults filled in. */
  values(): Record<string, unknown>
}

export interface PluginData {
  /** What `save` stored last, or null. */
  load(): unknown
  save(value: unknown): void
}

// MARK: - The editor

export interface Editor {
  registerExtension(ext: EditorExtension): Disposable
  /** Obsidian's `registerMarkdownCodeBlockProcessor`, drawn by a web page: a fenced block tagged `language`
   *  (```` ```excalidraw ````) shows as `page`, a whole HTML document, in place of its text while the cursor is
   *  elsewhere (Live Preview); clicking it opens the page full size to edit the block. The page runs in the app's web
   *  view, not here, and finds the block as `window.fulgurite` (`CodeBlockHost`). One page per language; the last
   *  registered wins. Open a block from a command with `commands.execute("block.open", String(offset))`. */
  registerCodeBlock(language: string, page: string): Disposable
}

/** `window.fulgurite` in a code block's page (`Editor.registerCodeBlock`). */
export interface CodeBlockHost {
  /** The text between the block's fences. */
  source: string
  /** "view": drawn in the note at the note's width, as tall as `resize` says, clicks open it; "edit": full size. */
  mode: "view" | "edit"
  /** The app's appearance. */
  dark: boolean
  /** view: the height the page needs, in CSS pixels. Call it again when that changes (the note got narrower). */
  resize(height: number): void
  /** edit: the block's new text. The app writes the last one into the note when the page closes. */
  save(source: string): void
}

/** The buffer as the shell shows it. Offsets are UTF-16 code units, i.e. plain JS string indices. Mutations apply immediately. */
export interface EditorView {
  readonly text: string
  readonly cursor: number
  /** [start, end) while the shell shows a selection, else null. */
  readonly selection: readonly [number, number] | null
  readonly clipboard: string
  /** [start, end) of the text on screen, for keys that scroll (Vim's CTRL-D, H, zz; scroll with `edit.scroll`). The
   *  whole text when the shell doesn't say. */
  readonly visible: readonly [number, number]
  moveCursor(offset: number): void
  select(start: number, end: number): void
  replace(start: number, end: number, text: string): void
  setClipboard(text: string): void
}

export interface EditorStatus {
  /** normal | insert | visual | visualLine | command. The shell keys the cursor shape and badge tint on this. */
  mode: string
  label: string
  pending: string
  commandLine: string
}

export interface EditorExtension {
  /** Extensions see keys (and give the status) highest first; ties in load order. Default 0. A modal keymap takes a
   *  high one so its normal mode consumes keys before helpers like Tables or Emoji see them: Vim's is 100. */
  priority?: number
  /** Keys: a single character, or `<Esc>` `<CR>` `<BS>` `<Space>` `<Tab>` `<S-Tab>` `<C-x>` `<Left>`…. Return true to
   *  consume the key (later extensions don't see it), false to hand it on and finally to the shell's native text input
   *  (typing, IME). */
  onKey?(key: string, view: EditorView): boolean
  status?(): EditorStatus
  /** Extra syntax on top of the core's markdown styles, recomputed after every edit. */
  styles?(text: string): StyleRange[]
}

/** A core markdown style borrowed for the plugin's own syntax: the shell already draws these in the text theme.
 *  `markup` marks syntax characters (your delimiters): muted, and hidden outside the lines being edited (Live Preview). */
export type StyleName = "strong" | "emphasis" | "strikethrough" | "inlineCode" | "codeBlock" | "link" | "blockQuote" | "taskDone" | "tag" | "wikiLink" | "markup" | "tableRule"

/** UTF-16 range, like the core's `StyledRange`. */
export interface StyleRange {
  start: number
  end: number
  style: StyleName
}
