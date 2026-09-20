# 🦁 HuaShi Pet Desktop Mascot · ECNU Edition Plugin

A desktop companion pet for the students and faculty of East China Normal University — "Happy HuaShi Lion" (幸福花狮). Built with the official "HuaShi Lion" sticker-pack imagery, it is an original Electron desktop pet that lives on your desktop: it gets hungry over time, studies and works with you, plays mini-games, visits the university clinic when sick, greets you in the morning, and stays up late with you while you work on your thesis.

> This plugin is an ECNU-edition exclusive: the current mascot is the HuaShi Lion only, submitted as an exclusive extension of the East China Normal University distribution.

## Features

- Status system: satiety / energy / mood change over time; it even gets hungry while offline
- Feeding: 8 kinds of food (cherries, xiaolongbao, braised lion's head, etc.), unlocked by level
- Study & level up: self-study rooms, lectures, final sprints — earn knowledge points to level up (cub → master lion 🎓)
- Mini-games: cherry rain, seat-grabbing battle, ECNU trivia quiz
- Work: 5 part-time jobs (TA, seat ambassador, lab assistant, etc.) to earn HuaShi coins
- Random events: cherry blossoms, ginkgo, library seat-grabbing, falling asleep in class...
- Time awareness: morning greetings, hourly chimes, late-night thesis company, bedtime
- Sickness & treatment: university clinic, drink more hot water, sleep it off
- Chat: configurable OpenAI-compatible APIs (DeepSeek / SiliconFlow, etc.); keys are stored locally only
- Actions & easter eggs: petting, rage clicks, nom-nom eating, workbench, dragging, double-click...

## Usage

Run standalone:

```bash
cd electron
npm install        # first time only
npm start
```

Or simply double-click `启动小花狮.bat` (dependencies install automatically on first run). Build a Windows x64 installer: `npm run build`.

**How it connects to the ECNU edition (pending maintainer confirmation)**: this plugin is currently submitted as a standalone component; whether it should be registered in `edition/distribution.json`, shipped with the ECNU distribution, and wired to the EduWork desktop extension point will be aligned with maintainers during PR review.

## Directory Structure

```
edition/plugins/huashi-pet/
├── electron/
│   ├── main.js          # Electron main process
│   └── src/
│       ├── pet.js       # Pet state machine & rendering logic
│       └── assets/      # HuaShi Lion sprites hs_*.png
├── index.html
├── style.css
├── phrases.js           # Lines / random event copy
├── package.json         # Plugin manifest
├── README.md            # This doc (Chinese)
└── README_EN.md         # English
```

## Assets & Copyright

- Mascot assets are based on ECNU's official "HuaShi Lion" public sticker pack (frames extracted from the Shanghai Observer 70th-anniversary "Go" series sticker GIFs, black background removed, slogan text cropped).
- Plugin code is MIT-licensed; **mascot assets are copyrighted by East China Normal University and may only be distributed and used personally within this plugin. Do not use commercially or re-distribute after modification.**

## Developer

- Developer: BH4GKQ Akatsuki (xhan51)
- Suggestions / feedback / bug reports: xhan@admin.ecnu.edu.cn
