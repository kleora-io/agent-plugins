#!/usr/bin/env node
/**
 * One version for `@kleora-io/mcp` and the Claude Code plugin, and a package
 * npm will accept from this repository.
 *
 *   node scripts/check-versions.mjs            # the four literals agree
 *   node scripts/check-versions.mjs 0.2.0      # ...and are at 0.2.0
 *
 * The plugin's version is the server's version: `claude plugin list` is the
 * only version a plugin user ever sees, and it has to say which server they
 * run. Four literals carry it:
 *
 *   packages/mcp/package.json                        "version"   (the authority)
 *   packages/mcp/src/version.ts                      VERSION     (serverInfo, User-Agent)
 *   plugins/claude-code/.claude-plugin/plugin.json   "version"
 *   plugins/claude-code/package.json                 "version"
 *
 * It also checks the shape npm's trusted publishing needs, each of which is
 * otherwise reported only by a refused first publish: the package is not
 * `private`, is published `public`, names this repository in `repository.url`,
 * and depends on nothing a workspace protocol would leave unresolvable.
 *
 * Reads files, writes nothing. CI runs it on every change; `release.yml` runs
 * it again before publishing.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_NAME = '@kleora-io/mcp'
const REPOSITORY = 'https://github.com/kleora-io/agent-plugins'
const NPM_REPOSITORY_URL = `git+${REPOSITORY}.git`
const PLUGIN_SOURCE = './plugins/claude-code'
const DEPENDENCY_KEYS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const VERSION_RE = /^export const VERSION = '([^']+)'$/m

const PATHS = {
  package: 'packages/mcp/package.json',
  versionTs: 'packages/mcp/src/version.ts',
  plugin: 'plugins/claude-code/.claude-plugin/plugin.json',
  pluginPackage: 'plugins/claude-code/package.json',
  marketplace: '.claude-plugin/marketplace.json',
}

/**
 * The problems found under `root`, as sentences; empty when everything holds.
 * `expected` is a version to insist on, or `undefined`.
 */
export function check(root, expected) {
  const problems = []
  const read = (path) => readFileSync(resolve(root, path), 'utf8')
  const json = (path) => JSON.parse(read(path))

  const manifest = json(PATHS.package)
  const plugin = json(PATHS.plugin)
  const versionTs = VERSION_RE.exec(read(PATHS.versionTs))

  if (manifest.name !== PACKAGE_NAME) problems.push(`${PATHS.package} is named ${manifest.name}, not ${PACKAGE_NAME}`)
  if ('private' in manifest) problems.push(`${PATHS.package} has "private": npm refuses to publish it`)
  if (manifest.publishConfig?.access !== 'public') {
    problems.push(`${PATHS.package} needs publishConfig.access "public": npm defaults a scoped package to restricted`)
  }
  if (manifest.repository?.url !== NPM_REPOSITORY_URL) {
    problems.push(
      `${PATHS.package} needs repository.url "${NPM_REPOSITORY_URL}": trusted publishing compares it with the publishing repository`,
    )
  }
  if (manifest.bin?.['kleora-mcp'] !== './dist/index.js') {
    problems.push(`${PATHS.package} needs bin.kleora-mcp "./dist/index.js", which is what npx runs`)
  }
  if (!(manifest.files ?? []).includes('dist')) problems.push(`${PATHS.package} needs "dist" in files`)
  for (const key of DEPENDENCY_KEYS) {
    for (const [name, spec] of Object.entries(manifest[key] ?? {})) {
      if (/^(workspace|link|file):/.test(String(spec))) {
        problems.push(`${PATHS.package} ${key} has ${name}: ${spec}, which nobody outside this workspace can resolve`)
      }
    }
  }

  if (plugin.repository !== REPOSITORY) problems.push(`${PATHS.plugin} repository must be ${REPOSITORY}`)
  const sources = Object.fromEntries((json(PATHS.marketplace).plugins ?? []).map((entry) => [entry.name, entry.source]))
  if (sources[plugin.name] !== PLUGIN_SOURCE) {
    problems.push(`${PATHS.marketplace} must offer ${plugin.name} from ${PLUGIN_SOURCE}`)
  }

  const literals = {
    [`${PATHS.package} version`]: manifest.version,
    [`${PATHS.versionTs} VERSION`]: versionTs?.[1],
    [`${PATHS.plugin} version`]: plugin.version,
    [`${PATHS.pluginPackage} version`]: json(PATHS.pluginPackage).version,
  }
  const versions = new Set(Object.values(literals))
  if (versions.size !== 1) {
    problems.push(
      'the server and the plugin are one version, and these differ:\n' +
        Object.entries(literals)
          .map(([where, version]) => `    ${where}: ${String(version)}`)
          .join('\n'),
    )
  } else if (expected !== undefined && manifest.version !== expected) {
    problems.push(`the manifests are at ${manifest.version}, not ${expected}`)
  }
  return problems
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const rootFlag = args.find((arg) => arg.startsWith('--root='))
  // `--root=<dir>` checks another tree with this layout; the tests use it.
  const root = rootFlag ? resolve(rootFlag.slice('--root='.length)) : resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const expected = args.find((arg) => !arg.startsWith('--'))?.replace(/^v/, '')
  const problems = check(root, expected)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`check-versions: ${problem}`)
    process.exit(1)
  }
  const { version } = JSON.parse(readFileSync(resolve(root, PATHS.package), 'utf8'))
  console.log(`check-versions: ${PACKAGE_NAME} and the plugin are both at ${version}`)
}
