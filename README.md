[English](README.md) | [简体中文](README.zh-CN.md)

# Online Stage Blocking Notes

## Introduction

Online Stage Blocking Notes is a web-based system for recording stage blocking in theater productions. It allows directors and stage managers to mark actor positions in real-time during rehearsals, edit dialogue, add notes, and sync across multiple users via Firebase.

## Features

- **Real-time Blocking Marks** - Click on the stage map to mark actor positions; supports drag adjustment, curved paths, and multi-select batch operations
- **Dialogue Editing** - Double-click to edit lines; supports adding/deleting lines with real-time sync
- **Notes System** - Add director's notes at precise character positions within dialogue (movement cues, performance notes, etc.)
- **Multi-user Sync** - Built on Firebase Realtime Database for automatic multi-user synchronization
- **Scene/Character Management** - Manage blocking by scene; switch between dialogue view and character view
- **Version Management** - Save version snapshots and restore to any previous version
- **PDF Export** - Export blocking notes as PDF with stage maps and dialogue side by side
- **Stage Image Management** - Upload and manage multiple stage layouts; assign different layouts to different scenes
- **Undo** - Ctrl+Z support for undoing blocking operations

## Getting Started

1. **Configure Firebase**
   - Create a Firebase project and enable Realtime Database
   - Fill in your Firebase configuration in `js/config.js`

2. **Prepare Data**
   - Edit the JSON files under `data/` with your script data
   - `characters.json` - Character information
   - `scenes.json` - Scene information
   - `lines.json` - Dialogue data

3. **Add Stage Images**
   - Place your stage layout images in the `stage-layouts/` directory

4. **Run Locally**
   ```bash
   # Use any static file server
   python3 -m http.server 8000
   # or
   npx serve .
   ```
   Then visit `http://localhost:8000`

## Tech Stack

- HTML5 / CSS3 / JavaScript (ES Modules)
- Firebase Realtime Database (v8 compat SDK)
- jsPDF + html2canvas (PDF export)

## Screenshots

<!-- Add application screenshots here -->
![Screenshot Placeholder](https://via.placeholder.com/800x450?text=Screenshot+Placeholder)
