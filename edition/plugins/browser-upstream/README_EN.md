# Official browser integration

[简体中文](README.md)

Pass the bundled Chromium path to DSH's official Playwright MCP provider. Tools, navigation, page reading and session resource management use the upstream implementation.

Runs headless by default; `headless: false` shows an independent browser window. It is separate from the sidebar and does not restore login state after restart. `executablePath` can select Chromium explicitly; otherwise the desktop resource environment supplies `DSH_MEDIA_BROWSER`.

The host-code tool `browser_run_code_unsafe` is available only in full-access mode. Regular page interactions follow the official provider.
