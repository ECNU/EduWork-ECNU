# Music Creation Plugin

[简体中文](README.md) | **English**

Conversational music tools for EduWork's ECNU edition: song creation, melody planning, covers, audio transcription, creation history and ABC staff notation. Use them with the `ecnu-music` skill in a conversation or through the separate Music Studio sidebar.

Sign in with a school account and describe the lyrics and style in a conversation with a workspace. Download completed artifacts, edit the ABC and use it in a new version. Covers and transcription accept workspace audio paths. An empty seed is random; an explicit seed overrides it. Generation supports one or two candidates.

`ecnu_music_render_score` saves ABC text or a workspace `.abc` file as a standalone offline HTML document with SVG staff notation, source ABC, download and print / save-as-PDF controls. This step runs locally without login or music model requests, and does not require opening Music Studio.

Use `ecnu_music_export_song` to export a complete song directory: `index.html` combines lyrics, an audio player and staff notation, with the original audio, lyrics text and ABC files alongside it. It supports looping, playback speed, notation zoom and printing. Audio uses a relative file link; copy the entire directory for offline sharing. Lyrics and notes do not have synchronized highlighting.

The current built-in HTML preview does not resolve sibling audio files. Open the complete page using the preview toolbar's browser button; the conversation also provides a standalone audio link for the client's audio preview. Export success does not verify embedded playback. This limitation does not require account or folder permission changes.

The UI and `ecnu-music` skill share the Host tools, permission checks and image/TTS school authorization interface; neither receives tokens. Titles, lyrics, parameters, parent versions and downloaded artifacts stay in the workspace. ABC engraving does not guarantee note accuracy or a complete orchestral score. This version does not offer stem editing or precise duration control.

Assembled through the ECNU distribution, without inclusion in the public edition. See the [music integration guide](../../../docs/MUSIC.md) for configuration, tools, local interactive preview and validation. Importing SKILL.md alone does not install the native tools or UI.
