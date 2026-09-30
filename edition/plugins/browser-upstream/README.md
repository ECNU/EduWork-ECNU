# 官方浏览器接入

[English](README_EN.md)

将发行包自带的 Chromium 路径传给 DSH 官方 Playwright MCP 提供方。工具、导航、页面读取及会话资源管理均沿用官方实现。

默认后台运行；`headless: false` 可显示独立浏览器窗口。浏览器与右侧面板隔离，重启不会恢复登录状态。`executablePath` 可显式指定 Chromium，默认读取桌面资源的 `DSH_MEDIA_BROWSER`。

普通网页操作沿用官方能力；执行本机代码的 `browser_run_code_unsafe` 工具仅在完全权限模式下可用。
