# GitHub Actions Structural Pipeline

Because of the massive FFmpeg extraction required, `@divortio/audio-decode-libav` leverages Web Assembly instances maintained on GitHub natively out of `@divortio/libav.js-audio`.

## Webhook Cascade Model (`repository_dispatch`)
To ensure our distributions perfectly capture the latest structural upgrades inside LibAV bindings, our CI acts aggressively inside a WebHooks graph natively inside GitHub integrations!

When the upstream library (`libav.js-audio`) completes its Docker deployment and successfully zips its 6 engines inside a matching Tag release version, its `.github/workflows/build.yml` payload fires an external custom webhook: `upstream-libav-updated`.

This repository natively listens to `upstream-libav-updated` dynamically constructing the 6 identical packages mirroring the new WASM layout!

Once `<audio-decode-libav>` successfully creates its `.zip` variants internally here, it triggers `upstream-audio-decode-updated` notifying downstream `<neiro-libav>` to transpile matching logic mappings!

### Build Configurations (`.github/workflows/build.yml`)
The workflow utilizes:
```yaml
on:
  repository_dispatch:
    types: [upstream-libav-updated]
```
Automatically booting standard `bash sync_and_build.sh` commands!
