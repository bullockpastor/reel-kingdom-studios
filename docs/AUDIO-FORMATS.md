# Audio Formats — Reel Kingdom Studios

The audio library and Assembly pipeline accept these file formats:

| Format | Extensions | Notes |
|--------|------------|-------|
| **MP3** | `.mp3` | Universal, good for music & SFX |
| **WAV** | `.wav` | Uncompressed, high quality |
| **OGG** | `.ogg` | Open format, common in game SFX |
| **AAC/M4A** | `.aac`, `.m4a` | Apple-friendly |
| **AIFF** | `.aiff`, `.aif` | Pro audio (Logic, Pro Tools, Vengeance, etc.) |

## Converting Other Formats

If you have `.flac`, `.wma`, or other formats, convert with FFmpeg:

```bash
# FLAC → MP3
ffmpeg -i input.flac -c:a libmp3lame -q:a 2 output.mp3

# AIFF → WAV (if needed)
ffmpeg -i input.aiff -c:a pcm_s16le output.wav

# Batch convert all .flac in a folder
for f in *.flac; do ffmpeg -i "$f" -c:a libmp3lame -q:a 2 "${f%.flac}.mp3"; done
```

## Where Files Go

- **Music:** `/Volumes/T9/ReelKingdomStudios/audio/music/`
- **SFX:** `/Volumes/T9/ReelKingdomStudios/audio/sfx/`

Set `AUDIO_LIBRARY_PATH=/Volumes/T9/ReelKingdomStudios/audio` in `.env`.
