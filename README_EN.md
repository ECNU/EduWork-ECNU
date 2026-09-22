<p align="center">
  <img src="https://raw.githubusercontent.com/ECNU/EduWork/main/assets/eduwork/icon-red.svg" width="72" height="72" alt="EduWork red logo">
</p>

<h1 align="center">EduWork@ECNU</h1>

<p align="center"><strong>An AI knowledge workbench for ECNU.</strong><br><sub>University sign-in · Campus services · Knowledge Studio</sub></p>

<div align="center">

[![License: MIT](https://img.shields.io/badge/license-MIT-3DA66B?style=flat-square)](LICENSE) [![Platform: Windows x64 / macOS arm64](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20arm64-9f2636?style=flat-square)](#installation-and-use)

[简体中文](README.md) | **English**

[University sign-in](#university-sign-in) · [Knowledge Studio](#knowledge-studio) · [Campus services](#campus-services) · [Get started](#installation-and-use) · [Public EduWork](https://github.com/ECNU/EduWork)

</div>

EduWork@ECNU is the East China Normal University edition of [EduWork](https://github.com/ECNU/EduWork). Sign in with a university account, explore teaching, research, and office materials in conversation, and create reports, presentations, quizzes, and flashcards in Knowledge Studio.

**The public edition provides open integration and the knowledge workbench; the ECNU edition connects university models and services.** You can still use personal API keys and other models.

## University sign-in

On first launch, the client automatically downloads and verifies university configuration. Sign in with a university account to discover authorized models, without manually entering endpoints or copying model API keys.

![A new EduWork@ECNU conversation with the university model ecnu-max selected](docs/images/school-model.png)

<p align="center"><sub>Sign in and choose a university model to begin. This example uses ecnu-max; availability depends on university services and account permissions.</sub></p>

University identity and model access reuse the public edition's open protocol implementation. The client manages model authorization and Token refresh after sign-in; personally configured models can coexist. The university model catalog and capabilities are maintained through configuration, without requiring a full application download for each adjustment.

## Knowledge Studio

**Inspired by NotebookLM, turn source materials into knowledge you can read, use, and practice.** The ECNU edition uses the same Knowledge Studio as the public edition, connecting university models to creation and learning in a local workspace.

### From sources to creation

Research and organize materials in conversation. Preview the resulting files and use them as sources in Studio. The example below starts with an HTML introduction to Lingang Campus, then creates a quiz from that material.

![EduWork@ECNU workspace: research campus information with a university model and preview a generated HTML page on the right](docs/images/workspace.png)

<p align="center"><sub>Conversation and output side by side: inspect the generated page, keep discussing, and revise it.</sub></p>

Open Studio on the right and choose an output:

| Create and organize | Understand and learn |
| --- | --- |
| Reports, spreadsheets, presentations | Mind maps, quizzes, flashcards |
| Export DOCX, XLSX, PPTX | Explore citations, answer questions, review explanations, ask follow-ups |

Audio and video overviews offer another way to explore sources. Speech and media capabilities depend on configured university services, account permissions, and local resources.

![EduWork@ECNU Studio: generate a quiz from workspace materials and view output types and an in-progress task in the sidebar](docs/images/studio.png)

<p align="center"><sub>Start generation from Studio, follow progress in the sidebar, then open completed items from Recent results.</sub></p>

### From reading to learning

Answer a generated quiz directly, review feedback and source evidence, and use Ask AI for follow-up questions. Flashcards support revision; the same materials can also become reports, presentations, or mind maps.

![EduWork@ECNU quiz: check answers, explanations, and source evidence, then ask AI a follow-up question](docs/images/quiz.png)

<p align="center"><sub>Return to the source behind an answer, then continue learning with new questions.</sub></p>

### Plugin capabilities shared with the public edition

Knowledge Studio is an independent plugin connected through the host's sidebar slots. Plugins can add output types or other Studio interfaces. Adapters and shared capabilities are maintained in the public project and reused by the ECNU edition.

[Explore Knowledge Studio](https://github.com/ECNU/EduWork/blob/main/packages/dsh-knowledge-studio/README_EN.md) · [Studio architecture and extension interfaces](https://github.com/ECNU/EduWork/blob/main/packages/dsh-knowledge-studio/docs/ARCHITECTURE.md)

## Campus services

### Campus search

Find administrative services, departments, policies, campus facilities, personal homepages, and university news in a conversation, retaining source links and opening original pages when needed. University matters prioritize campus sources; broader research can include public web and literature searches.

> Find the university's policies on research data management. Link to the originals and distinguish formal policies from news articles.

Search coverage depends on the university index and account permissions.

### Account and quota

Click the avatar in the lower-left corner to check remaining university model allowance, usage progress, and reset times. You can also inspect resource pools, refresh quota, or sign out.

The university server manages quota; personal API key quotas remain with their respective providers. Quota queries are an ECNU extension maintained separately from the public identity and model protocols.

### University models and media services

Open **Settings → Models** to view university service status and the model catalog, or add personal models. University image generation and speech synthesis are enabled according to configuration and account permissions, for images, narration, and explanatory content in conversations and Studio.

![Model settings show a connected ECNU AI service and its model catalog](docs/images/school-services.png)

<p align="center"><sub>Manage university services and personal models in one place. Available capabilities depend on service configuration and account permissions.</sub></p>

For text-only models on the configured university route, image understanding assistance can call a university vision model and pass textual evidence to the primary model. This assistance can be disabled. Models with native image input receive the original image directly, without an extra specialist call.

## Installation and use

Supports **Windows x64** and **macOS 15+ Apple Silicon (arm64)**. The client runs on your computer, without a separate EduWork server to deploy.

1. Download the complete desktop package for your platform from the university distribution channel or [GitHub Releases](https://github.com/ECNU/EduWork-ECNU/releases). On Windows, extract into a writable directory and run `EduWork-Electron.exe`, keeping the accompanying resources. On Mac, extract and move `EduWork-ECNU.app` to Applications. GitHub's Source code archives are not desktop packages.
2. On first launch, connect to the network to download university configuration. Follow the prompts to sign in and authorize access, then return to the client, check the university connection, and select a model.
3. Choose a local folder as your workspace and add your materials. Start a conversation or open Studio to select an output type.

Try: **“Create a study guide from these sources, then make a companion quiz.”**

The current macOS package does not use Apple Developer ID signing or notarization, so the first launch may show a system security prompt. See [macOS notes](https://github.com/ECNU/EduWork/blob/main/docs/MACOS.md) and the [Mac update guide](https://github.com/ECNU/EduWork/blob/main/docs/MACOS_UPDATES_EN.md) for software updates, system authorization, and platform requirements. University sign-in and common issues are covered in the [user guide](docs/USER_GUIDE.md).

## Configuration and data

The university maintains default connection settings, model and media configuration, branding, and update sources. Model configuration, feature switches, media settings, and official Skills can update independently and take effect after restart. Everyday use requires no manual entry of university settings.

For adjustments, open the single active `eduwork.jsonc` from Settings; the file includes configuration comments. Configuration updates preserve manual edits and retain only one previous configuration before an automatic rewrite for rollback. Personal models, credentials, and history remain separate.

| Platform | Active configuration |
| --- | --- |
| Windows | `config/eduwork.jsonc` under the application directory; configuration and application data stay with the portable directory. |
| macOS | `~/Library/Application Support/eduwork-chatecnu-electron/config/eduwork.jsonc`; configuration and application data live in the user directory. |

Workspace files remain in your chosen folder; moving the application does not move external workspaces. This repository provides [institutional configuration examples](edition/desktop-examples/README_EN.md). Actual university settings are retrieved on first launch and are not included in the source templates.

### Data and privacy

Conversations, workspace references, and memory are managed locally. When using university or other remote models, search, or media services, content needed for a task is sent to the corresponding service. Sign-in credentials are managed by local credential storage; do not put passwords or tokens in configuration files.

**Activity heartbeats are enabled in the university distribution.** After university sign-in, the client reports a random installation identifier, basic client information, and foreground/background status to university services. Signed-out clients do not report. Heartbeats do not read conversations or workspace file contents; see the [heartbeat plugin guide](edition/plugins/chatecnu-active-heartbeat/README_EN.md) for fields and configuration.

For troubleshooting, export a diagnostic ZIP in Settings, and a separate Session log for a specific conversation. Screenshots use demonstration material and retain existing privacy masks; generated content in them is not a factual reference.

## An example of institutional extension

This repository shows how a university connects its services to an open workbench. **Identity and model protocols, Knowledge Studio, and shared capabilities are maintained in [public EduWork](https://github.com/ECNU/EduWork); this repository maintains university configuration and extensions.**

| Mechanism | Use in the ECNU edition |
| --- | --- |
| Configuration | Supply defaults for university identity, models, media services, branding, and update channels. |
| Skills | Provide task guidance for campus search and related work. |
| Plugins | Add campus search, account quota, image assistance for text-only models, and activity heartbeats. |

Other schools and businesses can configure the public edition directly. When they need additional internal capabilities, they can combine their own plugins, skills, and distribution settings. The public edition natively supports LiteLLM and publishes identity and model-access protocols for gateway and client developers.

[Public project and contributions](https://github.com/ECNU/EduWork) · [Open integration initiative](https://github.com/ECNU/EduWork/blob/main/packages/dsh-oidc/docs/open-integration.en.md) · [Edition boundaries](https://github.com/ECNU/EduWork/blob/main/docs/EDITIONS.md) · [This edition's build guide](docs/BUILD.md)

## Documentation

| Guide | Contents |
| --- | --- |
| [ECNU user guide](docs/USER_GUIDE.md) | University sign-in, account quota, services, and common issues. |
| [Knowledge Studio](https://github.com/ECNU/EduWork/blob/main/packages/dsh-knowledge-studio/README_EN.md) | Source-based creation, learning interactions, and extension development. |
| [Configuration examples](edition/desktop-examples/README_EN.md) · [Configuration and Skills updates](https://github.com/ECNU/EduWork/blob/main/docs/CONTENT_UPDATES_EN.md) | University integration, single-file configuration, and independent content updates. |
| [EduWork user guide](https://github.com/ECNU/EduWork/blob/main/docs/USER_GUIDE.md) | Workspaces, models, search, speech, and file operations. |
| [Versioning and upgrades](https://github.com/ECNU/EduWork/blob/main/docs/RELEASE.md) · [Update sources](https://github.com/ECNU/EduWork/blob/main/docs/UPDATES.md) | Release channels, automatic updates, and data migration. |
| [Build guide](docs/BUILD.md) | Referencing the public core and assembling an institutional edition. |

Detailed documentation defaults to Chinese.

## Acknowledgments and license

EduWork@ECNU is built on [EduWork](https://github.com/ECNU/EduWork) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Knowledge Studio's source-based creation and learning interactions are inspired by NotebookLM.

Code in this repository uses the [MIT License](LICENSE). The public core and third-party components retain their own licenses; see the [EduWork third-party notices](https://github.com/ECNU/EduWork/blob/main/THIRD_PARTY_NOTICES.md).
