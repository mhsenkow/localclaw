---
name: xtts-voice
description: "Local TTS + voice cloning via Coqui XTTS-v2. Clone your voice from a short audio sample, then synthesize speech and play it back — fully local, no cloud."
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "os": ["darwin", "linux"],
        "install":
          [
            {
              "id": "pip-deps",
              "kind": "exec",
              "command": "python3 -m venv {baseDir}/.venv && {baseDir}/.venv/bin/pip install --quiet torch torchaudio coqui-tts",
              "label": "Install XTTS dependencies (Python venv + coqui-tts)",
            },
          ],
      },
  }
---

# xtts-voice

Clone your voice from a short audio sample (6+ seconds), then speak as you — fully local, no cloud, no Docker.

## Setup (one-time)

1. Install the skill (creates a Python venv with XTTS):

```bash
openclaw skills install xtts-voice
```

Or manually:

```bash
python3 -m venv {baseDir}/.venv
{baseDir}/.venv/bin/pip install torch torchaudio coqui-tts
```

2. Record a voice sample (6–30 seconds of you speaking clearly). Save it as a WAV:

```bash
# macOS: record 15 seconds from your mic
{baseDir}/bin/xtts-say --record ~/Desktop/my-voice.wav
```

Or use Voice Memos / QuickTime and export as WAV to `~/Desktop/my-voice.wav`.

3. Clone your voice:

```bash
{baseDir}/bin/xtts-say --clone ~/Desktop/my-voice.wav
```

This saves the cloned voice reference for future use. You only need to do this once.

## Usage

Speak with your cloned voice:

```bash
{baseDir}/bin/xtts-say "Hello, this is my cloned voice."
```

Save to a file without playing:

```bash
{baseDir}/bin/xtts-say --no-play -o ~/Desktop/speech.wav "Save this to a file."
```

### Flags

- `--clone <wav-path>` — clone a voice from a WAV sample (one-time setup)
- `--record <wav-path>` — record from microphone (macOS: uses `rec` or `sox`)
- `--language <code>` — language code (default: `en`)
- `-o <path>` / `--output <path>` — save audio to this path (default: temp file)
- `--no-play` — skip playback, just save the file

## Agent instructions

When the user asks you to **speak**, **say something aloud**, **read this aloud**, or **use their cloned voice**, call `xtts-say` via exec:

```
exec: {baseDir}/bin/xtts-say "The text to speak"
```

If they want the output saved to a file, pass `--no-play -o <path>`.

If the user wants to clone a new voice, ask them for a WAV file path and run:

```
exec: {baseDir}/bin/xtts-say --clone /path/to/voice-sample.wav
```

### Examples

- "Say hello in my voice" → `exec: {baseDir}/bin/xtts-say "Hello!"`
- "Read this paragraph aloud" → `exec: {baseDir}/bin/xtts-say "The paragraph text..."`
- "Save a voice memo saying good morning" → `exec: {baseDir}/bin/xtts-say --no-play -o ~/Desktop/memo.wav "Good morning!"`
- "Clone my voice from this file" → `exec: {baseDir}/bin/xtts-say --clone ~/Desktop/my-voice.wav`
