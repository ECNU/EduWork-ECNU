<p align="center">
  <img src="docs/images/readme-hero-en.svg" width="100%" alt="From source materials to finished work with EduWork — brand illustration">
</p>

<h1 align="center">EduWork@ECNU</h1>

<p align="center"><strong>Bring university AI services into your everyday work.</strong><br><sub>A desktop AI workspace for East China Normal University</sub></p>

<div align="center">

[![DSH 0.1.5-rc.2](https://img.shields.io/badge/DSH-0.1.5--rc.2-5367E8?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2) [![License: MIT](https://img.shields.io/badge/license-MIT-3DA66B?style=flat-square)](LICENSE) [![Desktop: Electron](https://img.shields.io/badge/desktop-Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://github.com/ecnu/EduWork/blob/main/dsh-electron/README_EN.md) [![Platform: Windows x64 / macOS arm64](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20arm64-0078D4?style=flat-square)](docs/USER_GUIDE.md)

[简体中文](README.md) | **English**

[Campus search](#campus-search) · [Account and quota](#account-and-quota) · [Institutional extensions](#an-example-of-institutional-extension) · [Documentation](#documentation)

</div>

EduWork@ECNU brings [EduWork](https://github.com/ecnu/EduWork) to East China Normal University. Sign in with a university account to use university models, find campus information, and work with your local materials for teaching, research, and everyday tasks.

It includes the full EduWork workspace, Studio, and skill center. University services connect through configuration and plugins, and you can still use personal API keys and other models.

![EduWork@ECNU workspace: turn local course materials into a teaching plan, shown in the red theme](docs/images/workspace.png)

<p align="center"><sub>The shared EduWork workspace, connected to university services. The theme defaults to red, with blue also available.</sub></p>

> University users obtain the client through the school distribution channel; it downloads school configuration on first launch. This repository presents the institutional extension; its templates do not include complete school deployment settings.

## What you can do

<table>
<tr>
<td width="50%" valign="top"><h3>Find campus information</h3><p>Search university services, departments, policies, and news, with links to the original sources.</p></td>
<td width="50%" valign="top"><h3>See your available resources</h3><p>Check university quota, resource pools, and reset times from your account menu.</p></td>
</tr>
<tr>
<td width="50%" valign="top"><h3>Connect university models</h3><p>Sign in to discover available models without copying API keys, and use university image and speech services according to your account permissions.</p></td>
<td width="50%" valign="top"><h3>Finish the work</h3><p>Keep the full EduWork workspace, Studio, skills, memory, and mail assistant.</p></td>
</tr>
</table>

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

After university sign-in and authorization, the client uses the login Token to discover and invoke authorized models, without creating or copying a separate model API key. Depending on account permissions, university image generation and speech synthesis services can also produce images, narration, and explanatory content in conversations or Studio. Personal models remain available alongside them.

These integrations reuse the public edition's OIDC, model, and media adapters, with services and configuration supplied by the university.

### Other university extensions

| Extension | Purpose and scope |
| --- | --- |
| Image understanding assistance | For text-only models on the configured university route, a university vision model can analyze an image and pass textual evidence to the primary model. This assistance can be disabled. Models with native image input receive the original image directly, without an extra specialist call. |
| Activity heartbeat | Enabled in the university distribution after university sign-in. It sends an installation identifier, basic client information, and foreground/background status to university services. Signed-out clients do not report; conversations and workspace file contents are not read. |

### Work with your materials

Choose a local folder as your workspace. Ask EduWork to read and organize sources, analyze data, edit files, or run scripts. Request outputs in a conversation or open Studio:

- **Reports, spreadsheets, and presentations**: create DOCX, XLSX, and PPTX files.
- **Mind maps, quizzes, and flashcards**: organize knowledge and prepare practice and revision materials.
- **Audio and video**: create narration and explanatory content, with media previews and downloadable subtitles.

Conversations and Studio share generation, previews, and downloads. The skill center, local memory, mail assistant, browser, local transcription, system speech synthesis, and blue/red themes are also included.

![Shared Studio capabilities: output types and a quiz generated from workspace materials, shown in the public edition](docs/images/studio.png)

<p align="center"><sub>This public-edition screenshot demonstrates Studio features shared by both editions. The ECNU edition uses university branding, accounts, and model configuration.</sub></p>

<details>
<summary>Explore quizzes and the skill center</summary>

![Check quiz answers, explanations, and source evidence, then ask AI a follow-up question, shown in the public edition](docs/images/quiz.png)

Answer a generated quiz directly, review explanations and source evidence, and use Ask AI to continue learning.

![Browse built-in skills, import skills, or create your own, shown in the public edition](docs/images/skills.png)

The skill center includes built-in task guidance and supports importing or creating your own skills. Both screenshots show shared features in the public edition.

</details>

## Configuration and data

The university maintains default connection settings, model and media configuration, branding, and update sources. On first launch, the client downloads and verifies university configuration. Model configuration, feature switches, media settings, and official Skills can also update independently and take effect after restart. Everyday use requires no manual entry of university settings.

For adjustments, open the single active `eduwork.jsonc` from Settings; the file includes configuration comments. Configuration updates preserve manual edits and retain only one previous configuration before an automatic rewrite for rollback. Personal models, credentials, and history remain separate. Windows keeps configuration and data in the portable installation directory; macOS uses the user directory. This repository provides [institutional examples](edition/desktop-examples/README_EN.md); the university distributes actual deployment settings.

Conversations, workspace references, and memory are managed locally. When using university or other remote models, search, or media services, content needed for a task is sent to the corresponding service. Sign-in credentials are managed by local credential storage; do not put passwords or tokens in configuration files.

For troubleshooting, export a diagnostic ZIP in Settings. For a specific conversation, export its Session log separately. See the [user guide](docs/USER_GUIDE.md).

## An example of institutional extension

**Bring your institution's services into a shared AI workspace.** This repository demonstrates how to build an institutional edition on EduWork.

It is also a practical example of the [Open Identity and Model Integration Initiative](https://github.com/ecnu/EduWork/blob/main/packages/dsh-oidc/docs/open-integration.en.md): university identity and models reuse the public integration contract, while institution plugins add campus search, quota, and other services. Other organizations can follow this division to bring their services into the shared workbench.

University features are maintained as configuration, skills, and plugins:

| Mechanism | Use in this repository |
| --- | --- |
| Configuration | Supply defaults for university identity, models, media, branding, and update channels, using the public edition's integration capabilities. |
| Skills | Describe how to perform tasks such as campus search, providing operational guidance to the agent. |
| Plugins | Provide campus search, account quota, image understanding assistance for text-only models, and activity heartbeats. Distribution configuration enables each capability; heartbeats use only the signed-in university account. |

Generic OIDC sign-in, model integration, image and TTS adapters, the workbench, Studio, previews, desktop, and update logic are maintained in [EduWork](https://github.com/ecnu/EduWork). This repository references a fixed version of the public core and adds institutional configuration and extensions.

Other schools and businesses can follow this structure to develop their plugins and skills and supply default configuration. Organizations that only need supported identity, model, and media APIs can configure the public edition directly. See the [build guide](docs/BUILD.md) and [public extension boundaries](https://github.com/ecnu/EduWork/blob/main/docs/EDITIONS.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [ECNU user guide](docs/USER_GUIDE.md) | University sign-in, account quota, services, and common issues. |
| [Configuration and Skills updates](https://github.com/ecnu/EduWork/blob/main/docs/CONTENT_UPDATES_EN.md) | One update entry, with separate software versions and content revisions. |
| [Configuration examples](edition/desktop-examples/README_EN.md) | University integration, models, media, branding, and updates. |
| [Build guide](docs/BUILD.md) | Referencing the public core, assembling institutional editions, and contributing. |
| [EduWork user guide](https://github.com/ecnu/EduWork/blob/main/docs/USER_GUIDE.md) | Workspaces, models, search, speech, and file operations. |
| [Versioning and upgrades](https://github.com/ecnu/EduWork/blob/main/docs/RELEASE.md) · [Update sources](https://github.com/ecnu/EduWork/blob/main/docs/UPDATES.md) | Versions, update channels, and migration requirements. |
| [macOS notes](https://github.com/ecnu/EduWork/blob/main/docs/MACOS.md) | Mac support and ways to contribute. |

Detailed documentation defaults to Chinese.

## Acknowledgments and license

EduWork@ECNU is built on [EduWork](https://github.com/ecnu/EduWork) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Code in this repository uses the [MIT License](LICENSE). The public core and third-party components retain their own licenses; see the [EduWork third-party notices](https://github.com/ecnu/EduWork/blob/main/THIRD_PARTY_NOTICES.md).
