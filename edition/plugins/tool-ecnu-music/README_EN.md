# Music Creation Plugin

[简体中文](README.md) | **English**

Conversational music tools for EduWork's ECNU edition: song creation, melody planning, covers, audio transcription, creation history and ABC staff notation. Use them with the `ecnu-music` skill in a conversation or through the separate Music Studio sidebar.

Sign in with a school account and describe the lyrics and style in a conversation with a workspace. Download completed artifacts, edit the ABC and use it in a new version. Covers and transcription accept workspace audio paths. An empty seed is random; an explicit seed overrides it. Generation supports one or two candidates.

`ecnu_music_render_score` saves ABC text or a workspace `.abc` file as a standalone offline HTML document with SVG staff notation, source ABC, download and print / save-as-PDF controls. This step runs locally without login or music model requests, and does not require opening Music Studio.

Use `ecnu_music_export_song` for a complete song directory with a background, all lyrics and an audio player. Mobile keeps the player visible while lyrics scroll; desktop shows notation alongside. Optional automatic reading traverses the lyrics over the song duration and does not claim sung-word synchronization. Score audition uses an offline synthetic timbre to play ABC notes with highlighting and pauses the original song; each voice has solo, mute, volume and synthetic timbre controls. Chord-symbol accompaniment is listed separately and can be disabled. It does not use the website's piano samples. Subtitle import and manual timing remain in a collapsed optional section. Copy the entire directory, including audio, lyrics, ABC and the shared time model, for offline use.

The skill can start a temporary loopback HTTP preview for one song directory, with audio seeking, startup records and a stop command. Alternatively, open the directory's HTML in an external browser. The built-in HTML file preview does not resolve sibling audio; open the HTTP URL as a web page and keep a standalone audio link in the conversation. Export success does not verify playback or synchronization, and no account or folder permission changes are needed.

The UI and `ecnu-music` skill share the Host tools, permission checks and image/TTS school authorization interface; neither receives tokens. Titles, lyrics, parameters, parent versions and downloaded artifacts stay in the workspace. ABC engraving does not guarantee note accuracy or a complete orchestral score. This version does not offer stem editing or precise duration control.

The music skill defaults to a 192 kbps MP3 listening copy and uses it in song pages, retaining the lossless source for further production. Song videos default to 720p H.264/AAC sharing copies, compressed locally with the installed media runtime. Explicit lossless or higher-quality requests take precedence. Download/export tools themselves preserve the input format; see the [media delivery presets](../../skills/ecnu-music/references/media-delivery.md).

Assembled through the ECNU distribution, without inclusion in the public edition. See the [music integration guide](../../../docs/MUSIC.md) for configuration, tools, local interactive preview and validation. Importing SKILL.md alone does not install the native tools or UI.
