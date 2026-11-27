# BhaiOS Local Speech Engine (`speech_engine/`)

100% offline Bengali + English code-switched ("Banglish") speech-to-text engine powered by **`kayees/whisper-medium-bn-en-cs-faster`** (Faster-Whisper + CTranslate2 INT8) and **Silero VAD** (bundled ONNX).

## Architecture

- `config.py` — Offline model path (`models/stt/whisper-medium-bn-en-cs-faster`), `int8` CPU config, thread settings.
- `audio_buffer.py` — 16 kHz mono resampling (`scipy.signal.resample_poly`) and thread-safe `RollingAudioBuffer` with configurable chunk & overlap windows.
- `vad.py` — `SileroVADFilter` using `faster_whisper.vad` ONNX to skip silence and low-level noise.
- `audio_capture.py` — `MicrophoneCapture` via `sounddevice` with pause/resume/stop and `MicrophoneError` handling.
- `engine.py` — Singleton `BanglishSpeechEngine` (`local_files_only=True`), script formatting (`mixed`, `bn_script`, `roman_banglish`), and `TXT`/`SRT` exporters.
- `streaming.py` — `StreamingSession` emitting `partial` drafts and `final` segments with `deduplicate_overlap()` to prevent repeated words across chunk boundaries.
- `api.py` — FastAPI REST & WebSocket (`/ws/transcribe`) router mounted in BhaiOS v2.

## First-Time Model Download

```bash
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('kayees/whisper-medium-bn-en-cs-faster', local_dir='models/stt/whisper-medium-bn-en-cs-faster')"
```

After download, `local_files_only=True` ensures zero internet calls.

## API & WebSocket Endpoints

- `GET /api/engine` — Engine & offline cache status.
- `POST /api/recording/start` | `/api/recording/pause` | `/api/recording/stop` — Server-side mic capture control.
- `POST /api/speech/transcribe` — File/blob Banglish transcription.
- `POST /api/speech/export` — Export `TXT` or `SRT` (with optional local save to `version2/data/transcripts/`).
- `WS /ws/transcribe` — Accepts 16 kHz `Float32` PCM binary frames + JSON control (`config`, `pause`, `resume`, `flush`, `stop`) and emits `status`, `partial`, `final`, and `error` events.

## Measured Benchmarks (macOS, CPU INT8, `cpu_threads=4`)

| Metric | Measured Result (`beam_size=5`) |
|---|---|
| Cold Model Load (`model.bin`) | **0.22 s** |
| 4.88 s Audio Inference | **8.33 s** (**RTF 1.71**) |

> **Performance Note:** On CPU, `whisper-medium` INT8 at `beam_size=5` runs at ~1.71× real-time. For lower latency during live streaming, set **Beam Size** to `1`–`2` and **Chunk Duration** to `5`–`6 s` in the Speech Studio settings panel.

## Run Tests

```bash
python3 -m pytest speech_engine/tests/test_speech_engine.py -v
```

## Troubleshooting

- **`FileNotFoundError: Offline model not found`**: Re-run the `snapshot_download` command above into `models/stt/whisper-medium-bn-en-cs-faster`.
- **`Microphone unavailable`**: Grant microphone permission to your terminal/browser in **macOS System Settings → Privacy & Security → Microphone**.
