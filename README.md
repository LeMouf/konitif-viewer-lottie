# @konitif/viewer-lottie

Host-driven Lottie reading, inspection, editing ports and canvas output for KONITIF.
Version **0.2.0** · [npm package](https://www.npmjs.com/package/@konitif/viewer-lottie).

## Features

- SVG reader with selection, layer tree, pan/zoom and construction overlays.
- Optional host ports for source editing, imports and Timeline operations.
- Canvas output for previews and textures, rendered only at host-requested frames.
- Bounded vector inputs; expressions, external assets and fonts are refused.

The host owns documents, time, commands and persistence. The renderer starts no
independent playback clock. See the [integration reference](docs/host-integration.md)
for supported operations, limits and consumer examples.

## Entry points

| Import | Purpose |
| --- | --- |
| `@konitif/viewer-lottie` | Tool declaration, contracts and profile validation |
| `@konitif/viewer-lottie/surface` | SVG reader and inspection controls |
| `@konitif/viewer-lottie/path-list` | Layer and path tree |
| `@konitif/viewer-lottie/editing` | Optional document editing with host-owned history |
| `@konitif/viewer-lottie/canvas` | Lazy canvas output for host-owned textures |
| `@konitif/viewer-lottie/reference` | Optional fuller SVG provider for comparison |

Peer dependencies: `@konitif/viewer` and `@konitif/tools`.
The rendering provider is pinned to `lottie-web` 5.13.0.

## Build and verify

From a standalone clone, using Node.js 22.14+ and npm 11.5.1+:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run verify:package
```

No sibling checkout is required. See the [release checklist](RELEASE.md),
[changelog](CHANGELOG.md) and [canvas qualification](qualification/canvas-output.v1.json).

## Licence and notices

Original integration code: **PolyForm Noncommercial 1.0.0**, see [LICENSE.md](LICENSE.md).
This is source-available software, not OSI open source. A public repository or
npm download grants no additional commercial rights. The KONITIF name, logo and
official identity belong to Maxime Mouflard; the separate trademark notice is in
the licence file.

The optional vendor and identified embedded code keep their **MIT** terms:
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[licenses/lottie-web-MIT.txt](licenses/lottie-web-MIT.txt). Preserve these notices,
attributions and upstream headers with redistributed code and browser bundles.
Third-party MIT components are excluded from the original-code licence grant.

No animation, font or artwork is included. User-supplied content keeps its own
rights and provenance. Provider hashes are in
[qualification/archive-review.json](qualification/archive-review.json).
