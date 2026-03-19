# Local Compilation Structure

This repository is built exclusively via step-oriented isolated bash wrappers invoking Native NPM implementations over pre-compiled FFmpeg WebAssembly wrappers retrieved from the `@divortio/libav.js-audio` package.

## Execution Sequence

In order to construct local development structures, launch the master sequential orchestration tool from the project root:

```sh
# Synchronizes the native compilation pipelines against 6 distinct architecture environments:
bash ./build/sync_and_build.sh
```

### Steps Handled Automatically
1. **03_BUILD** - Bootstraps local NPM configurations and recursively replicates `src/` inputs against the 6 mapped `libav.js-audio` distributions located dynamically upward one node level sequentially extracting dependencies dynamically (via `./build/steps/03_BUILD/build_variants.sh`).
2. **04_VALIDATE** - Triggers lightweight node lint scoping validation rules recursively isolating missing internal modules.
3. **05_TEST** - Triggers exhaustive comprehensive Node Test payloads iterating across 38 distinct media types via `runAll.test.js` validating that extraction works accurately per payload.
4. **06_PACKAGE** - Re-packages the individual node directories down inside `dist/audio-decode-libav-0.9.0/` sequentially directly into 6 output zips!

## Relation to Other Binaries
Because `audio-decode-libav` utilizes explicit statically compiled FFmpeg bindings, `libav.js-audio` **must be completely built locally within a parallel sibling directory structure** in the overall `divortioAudio` layout. `sync_and_build.sh` statically evaluates `../../../libav.js-audio/dist` to compile correctly.
