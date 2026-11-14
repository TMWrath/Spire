# Spire Voice Authoring — Implementation Brief

**Status:** Hosted implementation deployed; Android APK built and delivered. Physical-device transcription and Windows/Electron acceptance remain unverified.
**Project:** Spire
**Surfaces:** Hosted server, browser, Windows/Electron, Android Server workspace, Android Local workspace
**Purpose:** Give the implementation model a durable, self-contained specification for audio transcription and live dictation.

## Open-source attribution

Spire's voice-authoring credits identify the **Whistle speech-to-text model** and upstream **Needle 3 runtime** by Cactus Compute separately from the independent **cactus-needle npm wrapper** used by Spire. All three are distributed under the **Apache License 2.0**. The in-app and Settings credits link to their source pages and bundled license text. Whistle is Spire's only speech-to-text model; the former Whisper fallback and its supporting runtime assets have been removed.

## Product outcome

Spire already supports inserting and recording playable audio. Extend that foundation into a coherent **voice-authoring system** with two related but distinct workflows:

1. **Audio to full file** — convert an existing or newly recorded audio file into a complete Markdown file containing a transcript and, optionally, useful automatic organization.
2. **Live dictation** — let the user compose or extend the current file by speaking instead of typing, with optional spoken formatting commands.

These workflows must build upon the existing attachment, audio recording, editor insertion, rendering, save, revision, Local-provider, and Server-workspace paths. Do not create an isolated second editor or a proprietary document format.

## Product principles

- Store the written result as ordinary, portable Markdown.
- Keep the original audio recoverable until the user explicitly chooses otherwise.
- Never silently replace existing writing or an original transcript with AI-cleaned output.
- Make the transcription destination and processing location visible before processing begins.
- Treat Local and Server workspaces as separate authority boundaries; never upload Local audio merely because a Server connection exists.
- Route accepted text through Spire's normal editor/save/revision behavior, including stale-revision and conflict protection.
- Preserve the actual audio and full transcript even when generating summaries or structured sections.
- Fail safely: cancellation, provider failure, network loss, permission denial, and app interruption must not destroy existing writing or the captured recording.
- Maintain parity across hosted/browser, Windows, and Android wherever platform capabilities permit. Browser simulation is not physical Android acceptance.

---

# Feature A — Transcribe audio into a full file

## Entry points

The user should be able to initiate transcription from:

- **Media → Audio → Transcribe audio to file**;
- an existing audio attachment/player action named **Transcribe**;
- a newly recorded audio clip after recording completes;
- an imported supported audio file.

Do not remove or complicate the existing **Insert audio** and **Record audio** actions.

## Basic journey

1. User selects or records an audio file.
2. Spire shows a transcription dialog.
3. User selects the output mode and destination.
4. Spire clearly identifies where processing will occur.
5. Spire transcribes without mutating the current file.
6. Spire presents the generated file as a reviewable draft.
7. User accepts/saves, edits, retries, or cancels.
8. On acceptance, Spire creates and opens the new Markdown file through the normal workspace mutation path.
9. The generated file retains a portable relative reference to the source audio when that audio belongs to the same workspace.

## Output modes

Provide three modes:

### 1. Verbatim transcript

- Preserve spoken wording, repetitions, filler words, and false starts as closely as the speech engine allows.
- Add punctuation and speaker labels only where supported with reasonable confidence.
- Do not summarize or reorganize.

### 2. Clean transcript

- Repair punctuation and capitalization.
- Remove obvious filler and repeated false starts.
- Preserve meaning and ordering.
- Do not invent facts, conclusions, tasks, or speaker identities.
- Preserve access to the uncleaned/raw transcript in the processing record or draft review.

### 3. Structured file

Generate a useful Markdown file that may contain:

- title;
- optional summary;
- topic headings;
- key points;
- action items or tasks only when actually stated or strongly evidenced;
- full transcript;
- optional speakers and timestamps when available;
- reference to the original audio.

The full transcript must remain present or directly recoverable. A polished summary must never become the only surviving representation.

## Suggested portable Markdown

```markdown
---
type: transcript
audio: ../Attachments/project-planning-2026-10-18.m4a
transcribed: 2026-10-18
transcript_mode: structured
---

# Project planning conversation

<audio controls src="../Attachments/project-planning-2026-10-18.m4a"></audio>

## Summary

We discussed the publishing workflow and agreed that publication should remain manual.

## Key points

- Publishing remains an explicit action.
- Drafts retain revision protection.
- Android and Windows should behave consistently.

## Action items

- [ ] Design the publishing confirmation.
- [ ] Add revision-conflict coverage.

## Full transcript

**Speaker 1:** I was thinking that we could...

**Speaker 2:** That makes sense, but...
```

Frontmatter fields are a proposed portable representation, not permission to require Spire-specific metadata for reading the transcript. The body must remain understandable in another Markdown reader.

## Destination and naming

Allow the user to choose:

- destination folder;
- output filename/title;
- collision behavior through Spire's existing collision-safe naming rules;
- whether to open the generated file immediately.

A suggested title may be derived from the source filename or detected subject, but it must remain editable before file creation.

## Timestamps and speaker handling

When the transcription engine supplies segment timestamps, retain them in a portable/readable form. Later enhancement may allow clicking a timestamp to seek the linked audio. Do not fabricate timestamps by estimating from paragraph length.

Speaker labels should be conservative:

- use named speakers only if the user supplies names or the recording contains reliably established identities;
- otherwise use neutral labels such as `Speaker 1` and `Speaker 2`;
- expose uncertain diarization as uncertain rather than presenting it as fact.

## Existing-audio actions

An audio attachment/player may expose:

- Transcribe to file;
- Insert transcript at cursor;
- Open linked transcript;
- Retry transcription;
- Copy transcript.

`Insert transcript at cursor` is separate from full-file creation and must preserve the captured editor range and normal save/conflict semantics.

---

# Feature B — Live dictation into the current file

## Basic journey

1. User places the caret or selects a range in the current file.
2. User chooses **Dictate**.
3. Spire captures the insertion point before microphone UI takes focus.
4. User grants microphone permission if required.
5. A compact dictation strip/dialog shows recording state and interpreted text.
6. Speech becomes a pending transcript, not an immediate destructive rewrite.
7. User may pause, resume, finish, or cancel.
8. On Finish, Spire previews or inserts the accepted result at the captured range.
9. The accepted text enters the normal edit/save/revision flow.
10. Cancel leaves source unchanged and creates no orphaned attachment.

## Dictation modes

### Natural dictation

The user speaks normally. Spire supplies reasonable punctuation, sentence boundaries, capitalization, and paragraph cleanup. This mode does not interpret formatting commands.

### Command-aware dictation

The user can deliberately issue formatting and editing commands while speaking.

Command-aware mode must be explicitly enabled and visible. Structural commands should use a wake phrase to reduce accidental activation. Recommended syntax:

- `Spire, new paragraph`
- `Spire, heading two`
- `Spire, start bullet list`
- `Spire, end list`

Punctuation words such as “comma” and “period” may be configurable because users sometimes need to dictate those literal words.

## Initial command vocabulary

Start with a bounded, discoverable vocabulary:

### Structure

- Spire, new paragraph
- Spire, new line
- Spire, heading one through heading six
- Spire, normal text
- Spire, start bullet list
- Spire, start numbered list
- Spire, checklist item
- Spire, end list
- Spire, start quote
- Spire, end quote

### Inline formatting

- Spire, start bold
- Spire, end bold
- Spire, start italic
- Spire, end italic

### Editing/session

- Spire, undo that
- Spire, delete last sentence
- Spire, literal text
- Spire, end literal text
- Spire, pause dictation
- Spire, stop dictation

Do not attempt unlimited natural-language command interpretation in the first version. Ambiguous commands must remain spoken text rather than causing unpredictable edits.

## Command visibility and correction

While dictating, show interpreted structural commands as visible chips or tokens in the pending transcript, for example:

```text
The house was silent. [NEW PARAGRAPH] Something moved upstairs.
```

The user must be able to recognize that Spire interpreted speech as a command rather than prose. Ideally, a mistaken command can be converted back to literal text before insertion.

Provide a clear **Formatting commands on/off** control. Display a compact command reference without forcing the user into Settings.

## Result example

Spoken input:

> “Spire, heading two. Chapter Five. Spire, new paragraph. The house was silent. Spire, start italic. Something was waiting. Spire, end italic. Spire, new paragraph. Spire, start bullet list. Footsteps upstairs. Spire, checklist item. Check the bedroom door. Spire, end list.”

Stored Markdown:

```markdown
## Chapter Five

The house was silent. *Something was waiting.*

- Footsteps upstairs
- [ ] Check the bedroom door
```

The visual editor must render the accepted result normally while Source exposes the exact portable Markdown.

## Dictation interface

The active dictation UI should minimally expose:

- recording/listening state;
- elapsed time;
- live or chunked interpreted text;
- detected command chips when command mode is enabled;
- formatting-command toggle/status;
- Pause/Resume;
- Finish;
- Cancel;
- visible processing location/provider.

Do not obscure the entire file unnecessarily. Preserve the user's writing context and insertion point.

---

# Processing architecture

## Replaceable transcription provider

Define a narrow provider interface rather than coupling editor code to one service. It should accommodate:

- on-device/platform speech recognition;
- a self-hosted Whisper-compatible service;
- an optional configured external provider;
- batch/file transcription;
- streaming or chunked live dictation;
- timestamped segments;
- optional speaker diarization;
- provider capability discovery.

Conceptual interface:

```ts
type TranscriptSegment = {
  text: string;
  startMs?: number;
  endMs?: number;
  speaker?: string;
  confidence?: number;
};

type TranscriptionResult = {
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  provider: string;
};

interface TranscriptionProvider {
  capabilities(): Promise<TranscriptionCapabilities>;
  transcribeFile(input: AudioInput, options: TranscriptOptions): Promise<TranscriptionResult>;
  startDictation?(options: DictationOptions): Promise<DictationSession>;
}
```

Exact types should follow the existing codebase conventions after inspection.

## Privacy and authority boundaries

Before recording/transcription begins, state where processing occurs:

- On this device;
- On your Spire server;
- Through the configured external provider.

Rules:

- Do not silently send audio to an external service.
- Do not place provider secrets in the frontend or Android assets.
- Server-held provider keys remain server-side.
- Local workspace recordings remain local unless the user explicitly chooses a remote transcription route and consents to that upload.
- A connected Server workspace does not imply consent to upload a Local recording.
- Temporary server uploads must have explicit lifecycle and cleanup behavior.
- Logs must not contain raw transcript text, audio bytes, credentials, or sensitive request bodies.

## Raw audio and derived text

Treat these as related but separate assets:

- original audio is source evidence;
- raw transcript is a derived record;
- cleaned/structured Markdown is an editable authored result.

Never destructively rewrite the original audio. Avoid overwriting the raw transcript during cleanup. If processing fails after capture, retain enough local state to retry or export the recording.

## Auto-formatting pipeline

Separate transcription from document transformation:

1. audio decoding/normalization;
2. speech-to-text transcription;
3. optional diarization/timestamps;
4. deterministic punctuation/segment cleanup where possible;
5. optional AI-assisted structuring;
6. reviewable Markdown draft;
7. explicit acceptance through normal workspace mutation.

This separation allows users to retry formatting without retranscribing or re-uploading audio.

## Long-running jobs

Full-file transcription may outlive an HTTP request or app foreground session. Use durable job semantics where needed:

- stable job ID;
- queued/running/completed/failed/canceled states;
- progress when honestly available;
- safe retry without duplicate output files;
- resumable result retrieval;
- no final workspace mutation until acceptance;
- cleanup of expired temporary data without deleting accepted audio or files.

Do not show invented progress percentages if the provider cannot report meaningful progress.

## Supported formats

Inspect the existing recording/import path before fixing the final list. At minimum, account for common browser/Android/Windows outputs such as WebM/Opus, M4A/AAC, WAV, MP3, and OGG where the chosen processing backend supports them. MIME type, extension, and decoder behavior must agree. Normalize server-side or on-device only when required; retain the original attachment.

---

# Editor and storage integration

## Selection preservation

Both transcript insertion and dictation must:

- capture the active file, editor mode, revision, selection/caret, and edit generation before asynchronous work;
- revalidate that context before applying accepted text;
- refuse or request user resolution if the file changed incompatibly;
- avoid inserting into a newly opened file by accident;
- preserve touch behavior without unnecessarily summoning the Android keyboard.

## Revision and conflict safety

- Hosted/Server writes use existing revision/CAS protection.
- Android Local writes use the authoritative DocumentsProvider path.
- Never silently overwrite concurrent file changes.
- Pending dictated text remains recoverable if acceptance encounters a conflict.
- Applying a transcript is an ordinary user edit and should participate in history/revisions.

## Portable audio references

Continue storing relative audio references in Markdown, using the existing portable HTML audio contract:

```html
<audio controls src="../Attachments/example.m4a"></audio>
```

Resolve local/server attachment URLs only during rendering. Do not save authenticated API URLs, blob URLs, or machine-specific absolute paths into Markdown.

## Generated-file atomicity

Creating a transcript file and linking its audio must not produce a half-created visible file with a missing attachment reference. Use the existing attachment/file transaction boundaries where possible. If full atomicity is unavailable across the provider, stage and verify operations and expose honest recovery rather than claiming success early.

---

# Platform behavior

## Hosted browser

- Existing audio attachment and recording behavior remains intact.
- Batch transcription may use the authenticated Spire server provider.
- Browser microphone permission failures are explicit and non-destructive.
- Streaming support depends on browser/provider capabilities; fallback may record first and transcribe in chunks or after Stop.

## Windows/Electron

- Reuse the shared UI where practical.
- Keep provider credentials outside renderer context.
- Evaluate native/on-device transcription separately from server transcription.
- Verify microphone permission, codec, file access, and packaged runtime—not only browser development mode.

## Android Server workspace

- Shared UI may call authenticated Server transcription APIs.
- Microphone permission and WebView recording support require native/WebView acceptance.
- Server workspace and Local workspace remain visibly distinct.

## Android Local workspace

- DocumentsProvider files are authoritative.
- Capture and pending transcript must survive ordinary interruptions safely.
- Do not upload Local audio automatically.
- If only server/external transcription is available, obtain explicit user confirmation before upload and explain the destination.
- Accepted Markdown must be written through the Local runtime/provider path and preserve provider failure behavior.
- A provider failure after an operation may require authoritative readback; do not generalize success merely from a thrown error or hide genuine failures.

---

# Error and cancellation behavior

Explicitly design and test:

- microphone permission denied;
- no microphone/device unavailable;
- unsupported browser or codec;
- zero-length recording;
- canceled recording;
- canceled transcription;
- interrupted upload;
- lost network during transcription;
- provider timeout/rate limit/failure;
- malformed provider response;
- source audio deleted during processing;
- active file changed during dictation;
- revision conflict on acceptance;
- application backgrounding/process death;
- insufficient storage;
- duplicate output filename;
- revocation/authentication expiry;
- Local provider write/readback failure.

Expected safety invariant: existing file text and source audio remain intact unless a specific user-approved mutation completes successfully.

---

# Recommended implementation slices

## Slice 1 — Batch transcription foundation

- Inspect current audio insertion, recording, attachment upload, portable rendering, and workspace mutation paths.
- Define transcription provider interface and server capability endpoint.
- Add authenticated batch transcription job API.
- Add existing-audio **Transcribe to file** entry point.
- Support Verbatim and Clean modes.
- Produce a reviewable Markdown draft and explicit create/open action.
- Preserve original audio and relative reference.
- Verify hosted, Windows-packaged compatibility, Android Server, and Android Local authority behavior.

## Slice 2 — Structured file generation

- Add Structured mode.
- Separate raw transcription from formatting/transformation.
- Add summary, headings, key points, action items, full transcript, timestamps, and conservative speakers.
- Make unsupported/uncertain metadata visibly optional.
- Add retry-formatting without retranscribing.

## Slice 3 — Live natural dictation

- Add Dictate action at editor caret.
- Build pending transcript strip/dialog.
- Implement Pause/Resume/Finish/Cancel.
- Preserve/revalidate selection and file revision.
- Insert accepted portable Markdown through normal editor/save paths.
- Retain recoverable audio on failure when enabled.

## Slice 4 — Command-aware dictation

- Add explicit command-mode toggle.
- Implement bounded wake-phrase command parser.
- Show command chips and literal-text escape behavior.
- Add editing commands conservatively.
- Add in-editor command reference.
- Test prose containing command-like words.

## Slice 5 — Timestamp/audio navigation and polish

- Seek audio from transcript timestamps where portable/runtime support allows.
- Open linked transcript from audio.
- Improve speaker-name mapping and correction.
- Add language selection/detection controls.
- Add transcription history/job recovery UI.

Do not implement all slices as one unreviewable patch. Each slice should remain coherent across hosted and Android surfaces and preserve existing audio insertion.

---

# Acceptance criteria

## Batch transcription

- Existing audio can be selected and transcribed without altering the current file.
- Verbatim output preserves ordering and wording within engine limits.
- Clean output improves readability without inventing meaning.
- Structured output includes the full transcript or an immediately recoverable raw transcript.
- Output filename and folder are user-controlled and collision-safe.
- Created Markdown opens correctly after save/reload.
- Relative audio reference remains portable and renders through Spire's existing audio player.
- Cancel creates neither a file nor an orphan attachment.
- Failure retains source audio and retry capability.
- Revoked/expired sessions cannot retrieve results or mutate workspaces.

## Dictation

- Dictation inserts at the captured caret/range rather than the end or a newly opened file.
- Existing text outside the accepted insertion remains byte-faithful.
- Natural mode never interprets formatting commands.
- Command mode is explicit, visible, bounded, and wake-phrase-driven.
- Detected commands are visibly distinguishable before acceptance.
- Literal command-like prose can be dictated safely.
- Pause/Resume/Finish/Cancel behave predictably.
- Cancel is non-mutating.
- Concurrent file changes trigger safe resolution rather than overwrite.
- Accepted text survives save, reload, synchronization, and revision history.
- Touch use does not summon or dismiss the keyboard unexpectedly merely because a command control was tapped.

## Cross-surface

- Hosted production build and authenticated browser journey pass.
- Windows packaged renderer/runtime journey passes where affected.
- Android shared bundle matches the accepted frontend build.
- Android Local runtime regressions pass.
- Android Gradle `test lint assembleDebug` passes on `hermes-buildbox-1` after final source changes.
- Final APK is signed with the canonical local build host debug identity and its package/version/hash are verified.
- Physical Android microphone, WebView, DocumentsProvider, background/interruption, and keyboard behavior are tested separately; browser emulation is not reported as physical acceptance.
- Live private Spire preview deployment follows immutable-release, backup, rollback, health, authenticated behavior, and served-asset verification.

---

# Security requirements

- Authenticate every transcription job and result endpoint.
- Authorize source attachment access and output workspace mutation independently.
- Enforce file-size, duration, MIME, extension, and decoding limits.
- Do not trust client-provided filesystem paths or provider names.
- Keep external-provider credentials server-side or inside approved native secure storage.
- Apply bounded timeouts, concurrency limits, and job quotas.
- Prevent one device/account from retrieving another device's temporary audio or transcript.
- Ensure revoked devices lose job publication/retrieval/mutation access.
- Sanitize generated Markdown at render time through existing renderer protections.
- Do not execute dictated text as commands outside the bounded formatting grammar.
- Never map spoken phrases to filesystem deletion, deployment, shell execution, account actions, or other privileged operations.

---

# Decisions already established

- This is one coherent voice-authoring system with two workflows, not two unrelated buttons.
- Full-file transcription and live dictation are distinct interactions.
- Ordinary portable Markdown is the written storage format.
- Original audio and full/raw transcript must remain recoverable.
- Auto-formatting is optional and reviewable.
- Dictation formatting commands are optional, visible, bounded, and should use the `Spire` wake phrase.
- Local audio must not upload automatically.
- Existing Spire save, revision, attachment, and provider-authority paths must be reused.
- Android and hosted/server behavior must be developed and verified as one product.

# Product choices that may be finalized during implementation

The implementation model may recommend defaults after inspecting current architecture, but must not silently hard-code irreversible choices for:

- default transcription provider;
- whether recordings are retained by default after successful dictation;
- default output mode;
- maximum local/server recording duration;
- languages and auto-detection behavior;
- diarization availability;
- whether punctuation words require the wake phrase;
- timestamp syntax and seek behavior;
- temporary-job retention period.

Choose reversible defaults, document them, and keep provider/capability limitations honest.

---

# Implementation-model handoff

Before editing:

1. Inspect the current Spire and Spire Android repositories and both projects' feature/todo records.
2. Trace the existing audio recording, attachment upload, media insertion, rendering, editor selection, save/revision, hosted Store, Android Local runtime, and native WebView bridge paths.
3. Write an acceptance ledger for the selected implementation slice.
4. Add/update project-local and Vault planning records without overwriting this brief.
5. Preserve unrelated work and current deployed behavior.

During implementation:

- use tests to establish failure/success behavior before broad UI wiring;
- keep provider logic behind a narrow interface;
- keep raw transcription separate from cleanup/structuring;
- preserve cancellation and recovery paths;
- inspect both hosted and Android impact for every shared change;
- avoid logging private audio/transcript contents;
- do not weaken revision, provider, or Local-authority protections.

Completion for a Spire implementation slice includes:

- source implementation;
- relevant unit/API/browser/Local tests;
- production frontend build;
- Android shared-bundle parity where affected;
- buildbox Android `test lint assembleDebug` where affected;
- verified signed APK delivery when Android changes require a new APK;
- local commit(s) following the project's action boundaries;
- private preview deployment under Spire's standing deployment rule;
- live health, served-asset, and authenticated behavior checks;
- updated project-local and Vault documentation;
- an explicit report of physical-device behavior that remains unverified.

A commit does not authorize a source push unless the project owner explicitly requests one for the implementation task.
