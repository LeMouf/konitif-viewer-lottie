# Release candidate 0.1.0

Status: npm release prepared, not published. Source base: e465e4e. Public source
repository: https://github.com/LeMouf/konitif-viewer-lottie. The source is prepared
for main; repository publication and npm package publication are separate steps.
No registry publication is implied by the archive. The product consumer keeps its published dependency
boundary; no local tarball or sibling-source alias has been installed there.

## Qualified scope

- Existing SVG reader, inspection/editing host ports and reference surface retained.
- New lazy canvas entry with explicit host frame requests, no vendor autoplay,
  cloned sources and bounded canvas dimensions.
- Repeated integer frame requests reuse the existing pixels; resize invalidates
  the cache. Preparation cancellation/timeouts destroy partial renderers.
- TypeScript build and all 131 native Node tests pass.
- The real lottie-web 5.13.0 light-canvas provider rendered the vector pupil fixture
  at frames 0/66, skipped an unchanged frame and rendered again at 320 square.
  Measurements and vendor hashes are in qualification/canvas-output.v1.json.

The supplied fixture is a qualification input, not package-owned artwork. The
publication archive includes original and third-party notices. No Studio bridge,
robot identity, LED command admission, independent transport or mixer is added.

## Remaining publication decision

The public registry metadata request returned E404. This establishes only public
visibility at verification time; authenticate and verify scope/version rights at
the actual release step. Never infer ownership from that response.

Recommended first publication channel: explicit version 0.1.0, public access,
tag next. Keep latest unchanged. Consumers can pin the exact version after its
publication is verified. Actual publication requires explicit user authorization.

## Reproduce locally with existing tooling

1. From a standalone clone, run npm ci --ignore-scripts --no-audit --no-fund,
   then npm run build (the compiler is pinned in development dependencies).
2. Run node --test tests/*.test.mjs.
3. Review git diff --check, package exports, notices and qualification evidence.
4. Create the archive with pnpm pack; inspect its complete file list and digest.
5. After approval, publish the reviewed archive, not an unreviewed rebuilt tree:
   npm publish <reviewed-archive.tgz> --access public --tag next
6. Verify the registry's version, exports and integrity against the archive.
7. Only then add the exact published version to Behavior Studio, update its lock,
   and connect the host-driven output to the existing screen canvas compositor.
8. Validate reader controls, Timeline time, the animated pupil, per-screen
   calibration, disposal/reload and texture updates in the product.

The public source repository can be validated independently from the product.
Npm publication, release tag creation and product installation remain distinct
steps; the local candidate has not been installed into Behavior Studio.
