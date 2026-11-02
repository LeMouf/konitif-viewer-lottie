# Release 0.1.0

Published package: [@konitif/viewer-lottie](https://www.npmjs.com/package/@konitif/viewer-lottie).
Public source: [LeMouf/konitif-viewer-lottie](https://github.com/LeMouf/konitif-viewer-lottie).
Published source commit: 2af5969c6d0d1091f899001ea8987c335b9ee8db.

## Qualified scope

- Hosted SVG reading, inspection and optional editing ports.
- Lazy native canvas output driven by explicit host frames, with no vendor autoplay.
- Cloned sources, bounded resources, cancellation and deterministic disposal.
- Repeated integer frames reuse pixels; resize invalidates the cache.
- Standalone public-registry build, all 131 Node tests and GitHub validation passed.
- Native canvas review rendered the vector pupil fixture at frames 0/66,
  skipped an unchanged frame and rendered again at 320 square.

The package adds no robot identity, screen binding, LED authority, independent
transport or mixer. Those remain consumer responsibilities. The qualification
fixture is not distributed as package-owned artwork.

## Archive verification

The public registry archive was downloaded and matched the reviewed archive:

- Size: 106531 bytes; 100 files.
- SHA-256: ff04531a9d9594c574b494c67836c7f85cffa61125f89edb9732107e666b2fb3.
- Integrity: sha512-EI0iYsu96lXGr8/1vlMNLEpg/tqi5wOoQVaizikFvwt6GXRHWDOX8v/2BasXfL/wd5aDJmaarHgBnP3GRb33xA==.

Publication explicitly requested the next tag. The registry also exposed latest
for this first release and refused its authenticated deletion with HTTP 400.
Both tags currently point to 0.1.0; consumers should pin the exact version.
No claim is made that latest remained absent.

## Reproduce and prepare another release

1. Run npm ci --ignore-scripts --no-audit --no-fund from a standalone clone.
2. Run npm run build, npm test and npm run verify:package.
3. Review exports, notices, qualification evidence and git diff --check.
4. Increment the version before preparing another publication; published npm
   versions are immutable.
5. Obtain explicit authorization and publish the reviewed archive with public
   access and the intended tag. Verify registry metadata and downloaded bytes.
6. Install only the exact verified registry version into a consumer, then test
   its commands, host time, persistence, disposal and texture updates.

Original integration and third-party licence notices remain in LICENSE.md,
THIRD_PARTY_NOTICES.md and licenses/lottie-web-MIT.txt. Keep them with redistributed
archives and browser bundles. Provider evidence is in qualification/.
