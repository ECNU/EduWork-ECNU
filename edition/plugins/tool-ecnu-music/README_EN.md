# Music Studio

[简体中文](README.md) | **English**

An independent music sidebar for EduWork's ECNU edition: song creation, melody planning, covers, audio transcription, candidate playback and ABC staff notation. It is separate from Knowledge Studio, with three columns when expanded and paged views in a narrow sidebar.

Sign in with a school account, open Music Studio in a conversation with a workspace, and provide lyrics and style. Select completed artifacts to listen or inspect notation; edit the ABC and use it in a new version. Covers and transcription accept workspace audio paths. An empty seed is random; an explicit seed overrides it. Generation supports one or two candidates.

The UI and `ecnu-music` skill share the Host tools, permission checks and image/TTS school authorization interface; neither receives tokens. Titles, lyrics, parameters, parent versions and downloaded artifacts stay in the workspace. ABC engraving does not guarantee note accuracy or a complete orchestral score. This version does not offer stem editing or precise duration control.

Assembled through the ECNU distribution, without inclusion in the public edition. See the [music integration guide](../../../docs/MUSIC.md) for configuration, tools, local interactive preview and validation. Importing SKILL.md alone does not install the native tools or UI.
