# 3bySOUND

> **rhythm · reaction · precision**

A browser-based rhythm game built entirely with Vanilla JavaScript, the Web Audio API, and HTML5 Canvas. Players hit notes as they fly in from eight directions toward a 3×3 grid — no plugins, no frameworks, just the web platform.

---

## Table of Contents

- [Gameplay Overview](#gameplay-overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [How to Play](#how-to-play)
- [Scoring System](#scoring-system)
- [Level Format (Chart JSON)](#level-format-chart-json)
- [Official Levels CSV](#official-levels-csv)
- [Level Recorder](#level-recorder)
- [Settings & Keybinds](#settings--keybinds)
- [Credits](#credits)

---

## Gameplay Overview

3bySOUND presents a **3×3 grid** of cells (the center is the "shooter" anchor). Notes approach each of the 8 outer cells from their respective directions:

```
[TL]  [TC]  [TR]
[ML]  [ ⊕ ]  [MR]
[BL]  [BC]  [BR]
```

Notes travel along guide-lines from the screen's edges toward their target cell. The player must press the assigned key at the right moment to score a hit.

---

## Features

- **Official Levels** — Curated tracks loaded from a CSV index, with song metadata, difficulty ratings, and length.
- **Custom Levels** — Load any local MP3 audio file paired with a hand-crafted or recorder-generated JSON chart.
- **Level Recorder** — Real-time beat capture tool: load an MP3, hit keys on the keyboard while the track plays, and export a ready-to-use JSON chart.
- **Tiered Scoring** — Three hit tiers (300 / 100 / 50) based on timing precision, plus miss tracking with a fail threshold.
- **Rank System** — End-of-song letter rank (SS → D) based on overall hit performance.
- **Fully Rebindable Controls** — All 8 direction keys can be rebound from the Settings screen, with live swap-detection.
- **Adjustable Lead Time** — Note approach speed can be tuned from 0.5 s to 5.0 s globally.
- **Adjustable Hit Window** — Timing tolerance tunable from ±0.05 s to ±0.50 s.
- **Visual Effects** — Particle bursts and score popups on hit; color-coded by tier.
- **Dashed Guide Lines** — Canvas-drawn approach lines extend from each cell to the screen edge, redrawn on resize.
- **3-Second Countdown** — Both the game start and the recorder trigger a visual 3-2-1 overlay.
- **No dependencies** — Zero npm packages, zero bundlers. Ships as three files.

---

## Project Structure

```
├── index.html              # All HTML screens (splash, menu, game, recorder, settings, credits)
├── style.css               # Full styling — cyberpunk/retro aesthetic, animations, responsive layout
├── main.js                 # All game logic — navigation, engine, recorder, keybinds, guide lines
├── official_levels.csv     # Index of official tracks
└── assets/
    ├── songs/              # MP3 audio files for official levels
    └── charts/             # JSON chart files for official levels
```

---

## Getting Started

Because the game loads audio and CSV files via `fetch()`, it must be served over HTTP (not opened as a local `file://` URL).

To run the game locally, you must use a Visual Studio Code extension like **Live Server** to run the game locally.

Run the game with **Live Server** by:

1. Right click on the "index.html" file.
2. Click on "Run with Live Server".
3. Enjoy.

---

## How to Play

### Official Levels

1. From the Main Menu, select **PLAY → OFFICIAL LEVELS**.
2. Browse the track list. Use the search bar or sort by Name, Artist, Difficulty, or Length.
3. Click a track's **PLAY ▶** button. The game loads automatically and starts a 3-second countdown.
4. Hit incoming notes using the keyboard.

### Custom Levels

1. From the Main Menu, select **PLAY → CUSTOM LEVELS**.
2. In the game screen, load your **MP3 audio file** and a **JSON chart file** using the file pickers.
3. Once both are loaded, click **START GAME**.

### Default Keybinds

```
  Q        W        E
(Top-Left) (Top)  (Top-Right)

  A                 D
(Left)            (Right)

  Z        X        C
(Bot-Left)(Bottom)(Bot-Right)
```

### In-Game Controls

- **START GAME button** — Play / Pause
- **↺ RESTART button** — Restart (confirms before resetting score)
- **← MENU button** — Return to menu (pauses playback)

---

## Scoring System

Each hit is graded by how close it is to the note's exact target time.

**300** — within 0.08 s — 300 points — green burst  
**100** — within 0.15 s — 100 points — yellow burst  
**50**  — within hit window — 50 points — orange burst  
**MISS** — outside hit window — 0 points

The default **hit window** is ±0.25 s (adjustable in Settings).

### Miss Limit

The game tracks misses against a threshold of **15 misses**. Reaching the limit triggers an immediate **FAILED** screen.

### End-of-Song Ranks

**SS** — All 300s, zero misses  
**S**  — Zero misses, ≥ 90% 300s  
**A**  — ≥ 80% 300s, < 5% miss rate  
**B**  — ≥ 60% 300s, < 10% miss rate  
**C**  — ≥ 40% 300s  
**D**  — ≥ 20% 300s  

---

## Level Format (Chart JSON)

Chart files use a simple JSON structure. The key field is `recordedBeats`, an array of beat objects:

```json
{
  "spawnTiming": {
    "tl": { "label": "TOP-LEFT", "key": "Q", "spawnTime": 1.234 },
    "tc": { "label": "TOP",      "key": "W", "spawnTime": 2.345 }
  },
  "recordedBeats": [
    { "index": 1, "box": "tl", "label": "TOP-LEFT", "key": "Q", "time": 4.567 },
    { "index": 2, "box": "bc", "label": "BOTTOM",   "key": "X", "time": 5.123 }
  ]
}
```

### Beat Object Fields

- **`index`** — Beat sequence number (1-based)
- **`box`** — Target cell ID: `tl`, `tc`, `tr`, `ml`, `mr`, `bl`, `bc`, `br`
- **`label`** — Human-readable cell name (e.g. `"TOP-LEFT"`)
- **`key`** — Default key for this cell (e.g. `"Q"`)
- **`time`** — Exact audio timestamp in seconds when this note should be hit

The game also accepts the legacy key `RECORDED_BEATS` (uppercase) for backward compatibility.

---

## Official Levels CSV

The file `official_levels.csv` is the index for all built-in tracks. It is lazy-loaded the first time the **OFFICIAL LEVELS** screen is opened.

### CSV Schema

```
song_name,artist,difficulty,length_seconds,song_file,beat_config_file
```

- **`song_name`** — Display name of the track
- **`artist`** — Artist or composer name
- **`difficulty`** — Integer 1–10 (1–3 Easy · 4–6 Medium · 7–8 Hard · 9–10 Expert)
- **`length_seconds`** — Track duration in seconds
- **`song_file`** — Relative path to the MP3, e.g. `assets/songs/track.mp3`
- **`beat_config_file`** — Relative path to the JSON chart, e.g. `assets/charts/track.json`

### Current Official Tracks

**A New Kind Of Love (Perfection)** by Frou Frou — Difficulty ★5 — 1:49  
**Metamorphosis** by Interworld — Difficulty ★3 — 5:20

To add a new official level, place the MP3 and JSON chart in the appropriate `assets/` subfolders and append a row to `official_levels.csv`.

---

## Level Recorder

The **RECORD A CUSTOM LEVEL** tool lets you chart any MP3 from scratch in real-time.

### Workflow

1. Navigate to **CREATE → RECORD A CUSTOM LEVEL**.
2. Click **+ load mp3** and select an audio file.
3. Press **▶ play** (or `Space`) to start playback.
4. Click **● record** (or press `R`). A 3-second countdown plays, then recording begins.
5. While recording, press the 8 grid keys at the exact moments you want notes to fire. Each keypress is timestamped and added to the beat list.
6. Press **■ stop rec** or `R` again to stop.
7. Review beats in the **RECORDED BEATS** panel. Individual beats can be deleted with ✕.
8. Click **export config ↓** to preview the JSON, then **⇓ download .json** to save the chart file.

### Recorder Keyboard Shortcuts

- `Space` — Play / Pause
- `R` — Toggle recording on/off
- `Q W E / A D / Z X C` — Capture beats (active during recording only)

The Timing column also provides per-cell sliders to manually adjust the recorded spawn time for each cell.

---

## Settings & Keybinds

Access via **Main Menu → SETTINGS**.

### Audio

- **Master Volume** — 0% to 100%.

### Gameplay

- **Note Lead Time** — How many seconds before a note's target time it appears on screen (0.5 s – 5.0 s). Also accessible via the in-game slider.
- **Hit Window (±)** — Timing tolerance for registering a hit (0.05 s – 0.50 s).

### Keybinds

All 8 active cells can be rebound:

1. Click the key button for the cell you want to rebind.
2. The button shows `…` — press any key on your keyboard.
3. If the key is already bound to another cell, the two bindings **swap** automatically.
4. Press **↺ RESET TO DEFAULTS** to restore `Q W E / A D / Z X C`.


---

## Credits

**Lead Developer & Game Designer** — Josh Heidric C. Paraon  
**Lead Developer & Game Designer** — Jan Lorenze S. Fernandez

Built with **Vanilla JS · Web Audio API · Canvas**  
Fonts: **Orbitron · Share Tech Mono · Rajdhani**

---

*Thank you for playing 3bySOUND.*
