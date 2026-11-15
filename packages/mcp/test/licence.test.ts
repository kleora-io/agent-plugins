/**
 * What every artefact a person installs from this repository says about its
 * licence.
 *
 * npm's default licence, `UNLICENSED`, is not "undecided": it is all rights
 * reserved, no permission granted, so a legal review concludes the package may
 * not be used and some dependency scanners refuse it outright. The claims:
 *
 *   1. Every manifest says `Apache-2.0`, and none says `UNLICENSED`.
 *   2. Every licensed directory carries the *verbatim* Apache-2.0 text with the
 *      appendix filled in. The body must not be edited, reflowed or tidied, and
 *      the copies must be byte-identical to each other — a scanner that diffs
 *      them is looking for exactly that.
 *   3. `NOTICE` is absent from all of them. Apache-2.0 section 4(d) makes a
 *      NOTICE's contents an obligation every downstream redistributor
 *      inherits, and there is nothing to propagate.
 *   4. The plugin's committed bundle inlines third-party packages under MIT,
 *      BSD-3-Clause and ISC, all of which require their notice to travel with
 *      copies, and `plugins/claude-code/server/THIRD-PARTY-NOTICES` is how it
 *      does. The assertions below read the *shipped bundle* to decide what
 *      should be in that file, so they cannot agree with the generator by
 *      sharing its mistake.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = fileURLToPath(new URL('../../..', import.meta.url))

/** Every directory whose contents are licensed to whoever installs them. */
const LICENSED = ['.', 'packages/mcp', 'plugins/claude-code'] as const

/** Manifests that declare a licence, and must all declare the same one. */
const MANIFESTS = [
  'package.json',
  'packages/mcp/package.json',
  'plugins/claude-code/package.json',
  'plugins/claude-code/.claude-plugin/plugin.json',
] as const

const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8')

describe('what the manifests say', () => {
  it.each(MANIFESTS)('%s declares Apache-2.0 and not UNLICENSED', (manifest) => {
    const text = read(manifest)
    expect(text).not.toContain('UNLICENSED')
    const parsed = JSON.parse(text) as { license?: string }
    expect(parsed.license).toBe('Apache-2.0')
  })

  it('packages/mcp ships the licence in its tarball', () => {
    // npm includes a root `LICENSE` whatever `files` says, but every entry in
    // the array is spelled out, so a licence left implicit would read as one
    // nobody thought about.
    const parsed = JSON.parse(read('packages', 'mcp', 'package.json')) as { files: string[] }
    expect(parsed.files).toContain('LICENSE')
  })
})

describe('the licence text itself', () => {
  const texts = LICENSED.map((dir) => ({ dir, text: read(dir, 'LICENSE') }))

  it('is the same bytes in every licensed directory', () => {
    const first = texts[0]!
    for (const { dir, text } of texts) {
      expect(text, `${dir}/LICENSE differs from ${first.dir}/LICENSE`).toBe(first.text)
    }
  })

  it.each(texts.map(({ dir }) => dir))('%s/LICENSE is the unmodified Apache-2.0 body', (dir) => {
    const text = read(dir, 'LICENSE')
    // The canonical document is 202 lines and must not be reflowed. Spot-check
    // the clauses a paraphrase would lose, including the patent grant that is
    // the reason for choosing this licence over a shorter one.
    expect(text.trimEnd().split('\n')).toHaveLength(202)
    expect(text).toContain('                                 Apache License\n')
    expect(text).toContain('                           Version 2.0, January 2004\n')
    expect(text).toContain('3. Grant of Patent License.')
    expect(text).toContain('END OF TERMS AND CONDITIONS')
    expect(text).toContain('APPENDIX: How to apply the Apache License to your work.')
  })

  it.each(texts.map(({ dir }) => dir))('%s/LICENSE has the appendix filled in', (dir) => {
    const text = read(dir, 'LICENSE')
    // The appendix boilerplate is the one part meant to be completed. A
    // shipped `[yyyy]` is the tell that nobody did.
    expect(text).toContain('   Copyright 2026 Kleora\n')
    expect(text).not.toContain('[yyyy]')
    expect(text).not.toContain('[name of copyright owner]')
  })

  it.each(LICENSED)('%s ships no NOTICE', (dir) => {
    expect(existsSync(join(REPO, dir, 'NOTICE'))).toBe(false)
  })
})

/**
 * `plugins/claude-code/server/kleora-mcp.mjs` is a single self-contained file,
 * so every dependency is *copied* into it, and MIT, BSD-3-Clause and ISC each
 * require their copyright notice and permission text to be included with
 * copies.
 *
 * `THIRD-PARTY-NOTICES` beside the bundle is generated from the same build's
 * esbuild metafile (`scripts/generate-plugin-notices.mjs`), and
 * `pnpm check:plugin-server` fails when the committed copy is stale. That gate
 * protects the file against *drift*; these tests protect it against the
 * generator being wrong, by deriving the answer from the artefact instead.
 *
 * esbuild leaves each module's resolved path above it as a comment, and this
 * build is deliberately not minified, so the shipped bundle names every file it
 * carries and where it came from.
 *
 * `@kleora-io/*` packages are bundled too, and are not third parties: they are
 * Kleora code under the plugin's own Apache-2.0 licence.
 */
describe("the bundled server's third-party notices", () => {
  const PLUGIN = 'plugins/claude-code'
  const notices = read(PLUGIN, 'server', 'THIRD-PARTY-NOTICES')
  const bundle = read(PLUGIN, 'server', 'kleora-mcp.mjs')

  /** Every package the shipped bundle says it carries, keyed by name. */
  const carried = new Map<string, string>()
  for (const [, path] of bundle.matchAll(/^\/\/ (\S*node_modules\/\S+)$/gm)) {
    const marker = path!.lastIndexOf('node_modules/')
    const after = path!.slice(marker + 'node_modules/'.length).split('/')
    const name = after[0]!.startsWith('@') ? `${after[0]}/${after[1]}` : after[0]!
    // The directory the module was resolved from, so the licence text can be
    // compared against the installed package rather than against a copy of it.
    carried.set(name, resolve(REPO, 'packages/mcp', path!.slice(0, marker + 'node_modules/'.length) + name))
  }
  const bundled = new Map([...carried].filter(([name]) => !name.startsWith('@kleora-io/')))

  /** `name@version → { licence, text }`, parsed back out of the notices file. */
  const attributed = new Map<string, { version: string; licence: string; text: string }>()
  const [header, ...sections] = notices.split(`\n${'-'.repeat(76)}\n`)
  for (const section of sections) {
    const lines = section.trimStart().split('\n')
    const [name, version] = [lines[0]!.slice(0, lines[0]!.lastIndexOf(' ')), lines[0]!.slice(lines[0]!.lastIndexOf(' ') + 1)]
    const body = section.indexOf('\n\n', section.indexOf('The following is the verbatim '))
    attributed.set(name, {
      version,
      licence: lines[1]!.split('  ·  ')[0]!,
      text: section.slice(body + 2).replace(/\s+$/, ''),
    })
  }

  it('carries @kleora-io/core, which is Kleora code and not attributed', () => {
    // esbuild leaves no path comment above a module it hoists whole into the
    // entry's scope, which is what happens to core's single-file `dist`, so
    // look for its code instead: the credential lock is core's alone.
    expect(bundle).toMatch(/^async function withFileLock\(/m)
    expect([...attributed.keys()].filter((name) => name.startsWith('@kleora-io/'))).toEqual([])
    expect(notices).not.toContain('@kleora-io/core 0.')
  })

  it('attributes exactly the third-party packages the shipped bundle carries', () => {
    // Set equality in both directions: a dependency added to the bundle and not
    // attributed is an unmet obligation, and a package attributed but no
    // longer bundled is a notice for code we do not ship.
    expect([...attributed.keys()].sort()).toEqual([...bundled.keys()].sort())
    // `package.json` names three runtime dependencies besides core; a bundler
    // inlines transitive dependencies too, and this is the number that matters.
    expect(bundled.size).toBeGreaterThan(3)
  })

  it.each([...bundled.keys()].sort())("reproduces %s's licence text verbatim", (name) => {
    const root = bundled.get(name)!
    const entry = attributed.get(name)
    expect(entry, `${name} is bundled but not attributed`).toBeDefined()

    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      version: string
      license: string
    }
    expect(entry!.version).toBe(manifest.version)
    expect(entry!.licence).toBe(manifest.license)

    // Byte-for-byte the installed package's own file, trailing whitespace
    // aside — a summarised or reflowed licence is not the notice MIT asks for.
    const file = readdirSync(root).find((entry_) => /^licen[cs]e(\.(md|txt))?$/i.test(entry_))
    expect(file, `${name} ships no licence file`).toBeDefined()
    expect(entry!.text).toBe(readFileSync(join(root, file!), 'utf8').replace(/\s+$/, ''))
    expect(entry!.text).toMatch(/copyright/i)
  })

  it('covers the licences that are not MIT', () => {
    // BSD-3-Clause and ISC carry the same include-the-notice condition, so a
    // notices file that only understood MIT would be short.
    const licences = new Set([...attributed.values()].map((entry) => entry.licence))
    expect([...licences].sort()).toEqual(['BSD-3-Clause', 'ISC', 'MIT'])
  })

  it('says it is generated, by what, and why it is not a NOTICE', () => {
    expect(header).toContain('GENERATED FILE — do not edit.')
    expect(header).toContain('pnpm plugin-server')
    // Written where whoever edits the file reads it: a NOTICE would propagate
    // to everyone downstream under section 4(d).
    expect(header).toContain('not a `NOTICE` file')
    expect(header).toContain('section 4(d)')
    // And the boundary: none of this text licenses Kleora's own code.
    expect(header).toContain('../LICENSE')
    expect(existsSync(join(REPO, PLUGIN, 'server', 'NOTICE'))).toBe(false)
  })

  it('is part of what an installed plugin receives', () => {
    // The plugin is delivered by copying `plugins/claude-code/` from the
    // marketplace entry, so a committed file beside the bundle is received;
    // there is no npm tarball and therefore no `files` array to be left out of.
    // If one is ever added, the notices have to be in it — a notice nobody
    // receives discharges nothing.
    const manifest = JSON.parse(read(PLUGIN, 'package.json')) as { files?: string[] }
    if (manifest.files !== undefined) expect(manifest.files).toContain('server/THIRD-PARTY-NOTICES')

    const entry = (
      JSON.parse(read('.claude-plugin', 'marketplace.json')) as { plugins: { source: string }[] }
    ).plugins.map((plugin) => plugin.source)
    expect(entry).toContain(`./${PLUGIN}`)
  })

  it('is the only artefact that inlines anybody else’s code', () => {
    // The npm package declares its dependencies and lets the installer fetch
    // them, which needs no notices — but only while its build leaves them
    // external. A `noExternal` entry is what turns a `dist` into a copy, so it
    // is the thing to watch. A named entry may only be a first-party
    // `@kleora-io/*` package; the one config that may inline anything at all
    // is the plugin build, which is the one that ships notices.
    const configs: { path: string; named: string[]; patterns: number }[] = []
    for (const pkg of readdirSync(join(REPO, 'packages'))) {
      const dir = join(REPO, 'packages', pkg)
      if (!existsSync(join(dir, 'package.json'))) continue
      for (const file of readdirSync(dir).filter((name) => /^tsup\..*config\.ts$/.test(name))) {
        const found = /noExternal:\s*\[([^\]]*)\]/.exec(readFileSync(join(dir, file), 'utf8'))
        if (found === null) continue
        const entries = found[1]!
          .split(',')
          .map((entry) => entry.replace(/\/\/.*$/gm, '').trim())
          .filter((entry) => entry !== '')
        configs.push({
          path: `packages/${pkg}/${file}`,
          named: entries.filter((entry) => /^['"]/.test(entry)).map((entry) => entry.slice(1, -1)),
          // A regular-expression entry is a blanket "inline whatever resolves".
          patterns: entries.filter((entry) => entry.startsWith('/')).length,
        })
      }
    }

    // Every *named* inline is our own code, in every config.
    const foreign = configs.flatMap(({ path, named }) =>
      named.filter((name) => !name.startsWith('@kleora-io/')).map((name) => `${path}: ${name}`),
    )
    expect(foreign).toEqual([])

    // And exactly one config inlines by pattern rather than by name — the
    // plugin bundle, whose whole purpose is to carry everything, and which is
    // therefore the one artefact with a `THIRD-PARTY-NOTICES` beside it.
    expect(configs.filter(({ patterns }) => patterns > 0).map(({ path }) => path)).toEqual([
      'packages/mcp/tsup.plugin.config.ts',
    ])
    expect(attributed.size).toBeGreaterThan(0)
  })
})
