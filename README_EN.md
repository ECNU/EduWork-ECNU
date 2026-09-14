# EduWork@ECNU

[![DSH 0.1.5-rc.2](https://img.shields.io/badge/DSH-0.1.5--rc.2-5367E8?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2)
[![License: MIT](https://img.shields.io/badge/license-MIT-3DA66B?style=flat-square)](LICENSE)
[![Desktop: Electron](https://img.shields.io/badge/desktop-Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://github.com/ecnu/EduWork/blob/main/dsh-electron/README_EN.md)
[![Platform: Windows x64](https://img.shields.io/badge/platform-Windows%20x64-0078D4?style=flat-square)](docs/USER_GUIDE.md)

**A desktop AI assistant for East China Normal University students, faculty, and staff.**

[简体中文](README.md) | **English**

[Campus search](#campus-search) · [Account and quota](#account-and-quota) · [Institutional extension example](#an-example-of-institutional-extension) · [Documentation](#documentation)

EduWork@ECNU is the East China Normal University edition of [EduWork](https://github.com/ecnu/EduWork). Sign in with a university account to connect university models and campus services, then work with your local materials for learning, research, and everyday tasks.

School users should obtain the preconfigured client through the school distribution channel. This repository documents the institution extension; GitHub templates do not include a complete, ready-to-use school configuration.

It retains EduWork's shared capabilities, including workspace conversations, Studio, the skill center, search, memory, and the mail assistant. University services connect through configuration and plugins. You can still add personal API keys and other models.

## What you can do

The examples below introduce university extensions and the shared workspace features.

### Campus search

Find ECNU administrative services, departments, policies, campus facilities, personal homepages, and university news directly in a conversation. The agent can locate pages through the university search service and organize answers with titles, summaries, and source links. It can also open the original pages to check details.

Dedicated skill guidance prioritizes campus sources for university matters and combines them with public web and literature searches for broader research, keeping sources distinct and preserving citations. Search coverage depends on the university index and account permissions.

> Find the university's policies on research data management. Link to the originals and distinguish formal policies from news articles.

### Account and quota

Click the avatar in the lower-left corner to view your university account and model resource usage:

- **Usage allowance**: see the remaining allowance, usage progress, and next reset time for the quota window.
- **Resource pools and details**: inspect the allowance, expiration, and status of available resource packs separately.
- **Account actions**: refresh quota, view details, or sign out without leaving the workspace.

Quota queries use university-specific APIs, and values come from the server. Quotas for personal API keys remain with their respective providers.

### University models and media services

After university sign-in and the required authorization, the client obtains model credentials and configures university models. University image generation and speech synthesis services can also produce images, narration, and explanatory content in conversations or Studio. Personal models remain available alongside them.

These integrations reuse the public edition's OIDC, model, and media adapters, with services and configuration supplied by the university.

### Other university extensions

| Extension | Purpose and scope |
| --- | --- |
| Image understanding assistance | For text-only models on the configured university route, a university vision model can analyze an image and pass textual evidence to the primary model. This assistance can be disabled. Models with native image input receive the original image directly, without an extra specialist call. |
| Activity heartbeat | Connects client activity status to university services. Disabled by default; it requires server support and explicit distributor configuration. It sends an installation identifier, basic client information, and foreground/background status, without reading conversations or workspace file contents. |

### Work with your materials

![EduWork@ECNU workspace conversation: organize local course materials into a teaching plan, using the red theme](docs/images/workspace.png)

Choose a local folder as your workspace. Ask EduWork to read and organize sources, analyze data, edit files, or run scripts. Request outputs in a conversation or open Studio:

- **Reports, spreadsheets, and presentations**: create DOCX, XLSX, and PPTX files.
- **Mind maps, quizzes, and flashcards**: organize knowledge and prepare practice and revision materials.
- **Audio and video**: create narration and explanatory content, with media previews and downloadable subtitles.

Conversations and Studio share generation, previews, and downloads. The skill center, local memory, mail assistant, browser, local transcription, system speech synthesis, and blue/red themes are also included.

For example:

> Read the research materials in this folder and make a briefing outline. Cite the sources and flag questions that need verification.
>
> Find campus information and public literature about this research topic, and organize a reading list.
>
> Compare these spreadsheets, create an analysis report, then make a presentation for a briefing.

![EduWork@ECNU Studio: create teaching materials for a lesson plan using the same creation tools as the public edition](docs/images/studio.png)

## Configuration and data

University connection settings, branding, and update channels are maintained in configuration, separately from the public core. This repository supplies templates; the university maintains actual Client IDs and deployment settings. See the [institutional configuration examples](edition/desktop-examples/README_EN.md).

Conversations, workspace references, and memory are managed locally. When using university or other remote models, search, or media services, content needed for a task is sent to the corresponding service. Sign-in credentials are managed by local credential storage; do not put passwords or tokens in configuration files.

For troubleshooting, export a diagnostic ZIP in Settings. For a specific conversation, export its Session log separately. See the [user guide](docs/USER_GUIDE.md).

## An example of institutional extension

This repository also demonstrates how to build an institutional edition on EduWork. University features are maintained as configuration, skills, and plugins:

| Mechanism | Use in this repository |
| --- | --- |
| Configuration | Supply defaults for university identity, models, media, branding, and update channels, using the public edition's integration capabilities. |
| Skills | Describe how to perform tasks such as campus search, providing operational guidance to the agent. |
| Plugins | Provide campus search, account quota, image understanding assistance for text-only models, and an optional activity heartbeat. The heartbeat is disabled by default and requires server support and explicit enablement. |

Generic OIDC sign-in, model integration, image and TTS adapters, the workbench, Studio, previews, desktop, and update logic are maintained in [EduWork](https://github.com/ecnu/EduWork). This repository references a fixed version of the public core and adds institutional configuration and extensions.

Other schools and businesses can follow this structure to develop their plugins and skills and supply default configuration. Organizations that only need supported identity, model, and media APIs can configure the public edition directly. See the [build guide](docs/BUILD.md) and [public extension boundaries](https://github.com/ecnu/EduWork/blob/main/docs/EDITIONS.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [ECNU user guide](docs/USER_GUIDE.md) | University sign-in, account quota, services, and common issues. |
| [Configuration examples](edition/desktop-examples/README_EN.md) | University integration, models, media, branding, and updates. |
| [Build guide](docs/BUILD.md) | Referencing the public core, assembling institutional editions, and contributing. |
| [EduWork user guide](https://github.com/ecnu/EduWork/blob/main/docs/USER_GUIDE.md) | Workspaces, models, search, speech, and file operations. |
| [Versioning and upgrades](https://github.com/ecnu/EduWork/blob/main/docs/RELEASE.md) · [Update sources](https://github.com/ecnu/EduWork/blob/main/docs/UPDATES.md) | Versions, update channels, and migration requirements. |
| [macOS notes](https://github.com/ecnu/EduWork/blob/main/docs/MACOS.md) | Mac support and ways to contribute. |

Detailed documentation defaults to Chinese.

## Acknowledgments and license

EduWork@ECNU is built on [EduWork](https://github.com/ecnu/EduWork) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Code in this repository uses the [MIT License](LICENSE). The public core and third-party components retain their own licenses; see the [EduWork third-party notices](https://github.com/ecnu/EduWork/blob/main/THIRD_PARTY_NOTICES.md).
