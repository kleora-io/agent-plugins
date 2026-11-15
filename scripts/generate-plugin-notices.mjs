/**
 * Write the `THIRD-PARTY-NOTICES` that travels with the bundled MCP server.
 *
 * Called by `scripts/build-plugin-server.sh`, never on its own: the input is
 * the esbuild metafile of the build that produced the bundle, so the notices
 * and the bundle are two outputs of one build and cannot describe different
 * trees.
 *
 * Why it exists. `plugins/claude-code/server/kleora-mcp.mjs` is one
 * self-contained file — an installed plugin has no `node_modules`, so every
 * dependency is compiled into it. A bundle is a *copy*, and MIT, BSD-3-Clause
 * and ISC each require their copyright notice and permission text to be
 * included with copies.
 *
 * Why the metafile rather than `package.json`. A bundler pulls in transitive
 * dependencies, and what has to be attributed is whatever ended up in the
 * file, and `packages/mcp/package.json` declares far fewer packages than the
 * bundle contains. A hand-written list, or one built from declared
 * dependencies, would be wrong the day it was written.
 *
 * Kleora's own packages (`@kleora-io/*`, today `@kleora-io/core`) are bundled
 * too but are not listed: they are Kleora code under the same Apache-2.0
 * licence as the plugin itself (`../LICENSE`), not third-party code.
 *
 * Why not a `NOTICE`. Apache-2.0 section 4(d) makes a `NOTICE` file's contents an
 * obligation every downstream redistributor inherits, so putting these texts
 * there would bind everyone downstream to carry them onward — more than MIT,
 * BSD or ISC asks of us, for nothing.
 *
 * It fails rather than guesses. A bundled package with no licence file, no
 * `license` field, or a licence text carrying no copyright line stops the
 * build naming the package — the one outcome worse than no notices file is one
 * that looks complete and is not.
 *
 * Usage:
 *   node scripts/generate-plugin-notices.mjs --metafile <path> --cwd <dir> --out <path>
 *
 *   --metafile  esbuild metafile written by the plugin build
 *   --cwd       the directory the build ran in; the metafile's paths are
 *               relative to it
 *   --out       where to write the notices
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SEPARATOR = '-'.repeat(76)

/** Licence text lives in a file named like one of these. */
const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || process.argv[index + 1] === undefined) {
    fail(`missing --${name}`)
  }
  return process.argv[index + 1]
}

function fail(message) {
  process.stderr.write(`generate-plugin-notices: ${message}\n`)
  process.exit(1)
}

/**
 * Every package the build actually put bytes into the bundle from, keyed by
 * name and mapped to the directory it was resolved from.
 *
 * A metafile input path is relative to the build's working directory and ends
 * in the package's own layout, so the package root is everything up to and
 * including the last `node_modules/<name>` — which is pnpm-store-shaped here
 * (`.pnpm/zod@4.5.4/node_modules/zod/...`) but needs no knowledge of that: the
 * version and the licence are read from the resolved `package.json`, not
 * parsed out of the path.
 */
function bundledPackages(metafile, buildCwd) {
  const roots = new Map()
  const bytes = new Map()
  const record = (path, contributed) => {
    const marker = path.lastIndexOf('node_modules/')
    if (marker === -1) return
    const after = path.slice(marker + 'node_modules/'.length).split('/')
    const name = after[0].startsWith('@') ? `${after[0]}/${after[1]}` : after[0]
    // Kleora's own code, under the plugin's own licence: not a third party.
    if (name.startsWith('@kleora-io/')) return
    roots.set(name, resolve(buildCwd, path.slice(0, marker + 'node_modules/'.length) + name))
    bytes.set(name, (bytes.get(name) ?? 0) + contributed)
  }

  // `outputs[…].inputs` is the authority over `inputs`: it carries
  // `bytesInOutput`, so a module esbuild parsed and then tree-shook away
  // entirely is not attributed as if we shipped it.
  for (const output of Object.values(metafile.outputs)) {
    for (const [path, detail] of Object.entries(output.inputs ?? {})) {
      record(path, detail.bytesInOutput ?? 0)
    }
  }

  return [...roots]
    .filter(([name]) => (bytes.get(name) ?? 0) > 0)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, root]) => describe(name, root))
}

function describe(name, root) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  } catch (error) {
    fail(`cannot read ${root}/package.json for ${name}: ${error.message}`)
  }
  if (typeof manifest.license !== 'string' || manifest.license === '') {
    fail(`${name} declares no license in its package.json — attribute it by hand or drop it`)
  }

  const file = readdirSync(root).filter((entry) => LICENCE_FILE.test(entry)).sort()[0]
  if (file === undefined) {
    fail(
      `${name}@${manifest.version} ships no licence file, so there is no text to reproduce. ` +
        `Find the text in its repository and add it to this script's exceptions rather than shipping without it.`,
    )
  }

  const text = readFileSync(resolve(root, file), 'utf8').replace(/\s+$/, '')
  if (!/copyright/i.test(text)) {
    fail(`${name}@${manifest.version}'s ${file} carries no copyright line — check it by hand`)
  }

  return {
    name,
    version: manifest.version ?? 'unknown',
    licence: manifest.license,
    file,
    homepage: homepageOf(manifest),
    text,
  }
}

function homepageOf(manifest) {
  if (typeof manifest.homepage === 'string' && manifest.homepage !== '') return manifest.homepage
  const repository = manifest.repository
  const url = typeof repository === 'string' ? repository : repository?.url
  if (typeof url !== 'string' || url === '') return null
  return url.replace(/^git\+/, '').replace(/\.git$/, '')
}

function render(packages) {
  const licences = [...new Set(packages.map((entry) => entry.licence))].sort()
  const heading = 'THIRD-PARTY NOTICES — server/kleora-mcp.mjs'

  const lines = [
    heading,
    '='.repeat(heading.length),
    '',
    'GENERATED FILE — do not edit.',
    'Written by `pnpm plugin-server` from the build that produced the bundle',
    'beside it, and checked by `pnpm check:plugin-server`. Change what the',
    'server depends on and this file changes with it.',
    '',
    '`server/kleora-mcp.mjs` is one self-contained file. An installed plugin',
    'has no `node_modules`, so every dependency the server needs is compiled',
    'into the bundle — which makes the bundle a copy of each of them. The',
    'licences below require their copyright notice and permission text to be',
    'included with copies, and this file is how they travel.',
    '',
    'It is deliberately not a `NOTICE` file. Apache-2.0 section 4(d) would turn',
    "its contents into an obligation every downstream redistributor of this",
    'plugin inherits, which is more than any licence here asks of us.',
    '',
    'The Kleora code in this plugin, `@kleora-io/core` included, is licensed',
    'separately, under the Apache License, Version 2.0 — see `../LICENSE`.',
    'Nothing below is Kleora code, and nothing below is licensed under that',
    'licence.',
    '',
    `${packages.length} bundled packages, under ${licences.length} licence${licences.length === 1 ? '' : 's'} (${licences.join(', ')}):`,
    '',
    ...packages.map((entry) => `    ${entry.name} ${entry.version} — ${entry.licence}`),
    '',
    '`@napi-rs/keyring` is not in this list and is not bundled: it is a native',
    'module per platform, left external and optional, so it arrives as its own',
    'installed package carrying its own licence file.',
    '',
  ]

  for (const entry of packages) {
    lines.push(
      SEPARATOR,
      '',
      `${entry.name} ${entry.version}`,
      `${entry.licence}${entry.homepage === null ? '' : `  ·  ${entry.homepage}`}`,
      '',
      `The following is the verbatim ${entry.file} of ${entry.name} ${entry.version}.`,
      '',
      entry.text,
      '',
    )
  }

  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

const metafilePath = argument('metafile')
const buildCwd = argument('cwd')
const outPath = argument('out')

let metafile
try {
  metafile = JSON.parse(readFileSync(metafilePath, 'utf8'))
} catch (error) {
  fail(`cannot read the metafile at ${metafilePath}: ${error.message}`)
}

const packages = bundledPackages(metafile, buildCwd)
if (packages.length === 0) {
  // The bundle has never had zero third-party packages, so an empty list means
  // the metafile is not the one this build wrote, or `noExternal` stopped
  // inlining. Either way it must not produce a file claiming there is nothing
  // to attribute.
  fail(`${metafilePath} names no bundled third-party package — refusing to write an empty notices file`)
}

writeFileSync(outPath, render(packages))
process.stdout.write(
  `generate-plugin-notices: ${packages.length} packages (${packages.map((entry) => entry.name).join(', ')})\n`,
)
