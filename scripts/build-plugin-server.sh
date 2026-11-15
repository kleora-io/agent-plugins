#!/usr/bin/env bash
# Build the plugin's copy of the MCP server and the third-party notices that
# travel with it, or (--check) verify that the committed copies already match
# what `packages/mcp/src` and its dependency tree produce.
#
# `plugins/claude-code/` is what a person installs. The host copies that
# directory and launches `node ${CLAUDE_PLUGIN_ROOT}/server/kleora-mcp.mjs`,
# with no `node_modules` anywhere near it, so `packages/mcp`'s ordinary
# `dist/index.js` (which leaves its dependencies as bare imports) cannot be the
# file it runs. `packages/mcp/tsup.plugin.config.ts` inlines everything except
# the optional native keychain module, and the single self-contained result is
# committed.
#
# Inlining a dependency makes the bundle a *copy* of it, and the MIT,
# BSD-3-Clause and ISC licences of the packages that end up in there require
# their copyright notice and permission text to be included with copies. So
# `THIRD-PARTY-NOTICES` is the build's second output, generated from the same
# build's esbuild metafile by `generate-plugin-notices.mjs`. One build writes
# both, which is what stops the notices from describing a different tree from
# the bundle they sit beside.
#
# Committed rather than built on install because the artefact has to exist in
# the tree a person receives, and the diff that changes it has to be
# reviewable.
#
# Two modes: `pnpm plugin-server` writes, for a developer who changed the
# server; `pnpm check:plugin-server` (this script with --check) only verifies,
# and is what CI runs. A gate that repaired the tree it was checking could
# never fail.
set -euo pipefail

cd "$(dirname "$0")/.."

DESTINATION_DIRECTORY="plugins/claude-code/server"
BUNDLE="kleora-mcp.mjs"
NOTICES="THIRD-PARTY-NOTICES"

MODE="write"
if [ "${1:-}" = "--check" ]; then
    MODE="check"
elif [ $# -gt 0 ]; then
    echo "build-plugin-server: unknown argument '$1' (expected --check or nothing)" >&2
    exit 2
fi

# Always a temporary directory, in both modes. The metafile the notices are
# generated from is a build product and only the two artefacts a customer
# receives belong in the plugin; and building the same way in both modes means
# the check compares against exactly what the write mode would have copied.
out="$(mktemp -d)"
# shellcheck disable=SC2064  # expand $out now, while it is still set
trap "rm -rf '$out'" EXIT

KLEORA_PLUGIN_SERVER_OUT="$out" \
    pnpm --filter @kleora-io/mcp --silent build:plugin >/dev/null

[ -f "$out/$BUNDLE" ] || {
    echo "build-plugin-server: the build produced no $out/$BUNDLE" >&2
    exit 1
}
[ -f "$out/metafile-esm.json" ] || {
    echo "build-plugin-server: the build produced no metafile; is 'metafile: true' still set" \
        "in packages/mcp/tsup.plugin.config.ts?" >&2
    exit 1
}

# `--cwd` is where the build ran, because a metafile's input paths are relative
# to it.
node scripts/generate-plugin-notices.mjs \
    --metafile "$out/metafile-esm.json" \
    --cwd packages/mcp \
    --out "$out/$NOTICES" >/dev/null

if [ "$MODE" = "write" ]; then
    for artefact in "$BUNDLE" "$NOTICES"; do
        cp "$out/$artefact" "$DESTINATION_DIRECTORY/$artefact"
        echo "build-plugin-server: wrote $DESTINATION_DIRECTORY/$artefact" \
            "($(wc -c <"$out/$artefact" | tr -d ' ') bytes)"
    done
    exit 0
fi

stale=""
for artefact in "$BUNDLE" "$NOTICES"; do
    cmp -s "$out/$artefact" "$DESTINATION_DIRECTORY/$artefact" || stale="$stale $artefact"
done

if [ -z "$stale" ]; then
    echo "build-plugin-server: $DESTINATION_DIRECTORY/{$BUNDLE,$NOTICES} are current"
    exit 0
fi

{
    for artefact in $stale; do
        echo "build-plugin-server: $DESTINATION_DIRECTORY/$artefact does not match a fresh build of packages/mcp."
    done
    echo "  The bundle is what an installed plugin actually runs — it has no"
    echo "  node_modules, so it carries the whole server — and"
    echo "  $NOTICES is the attribution that has to travel with the copies of"
    echo "  the dependencies inside it."
    echo "  Run 'pnpm plugin-server' and commit the result."
} >&2
exit 1
