# Video capture

## First-party video capture

Media → Video capture opens local videos or accessible public video feeds. The Spire-owned interface provides playback, seeking, speed controls, approximate 1/30-second stepping, frame preview, and clips up to 30 seconds / 8 MB. Insertion preserves the file/template cursor and saves a durable attachment plus reusable Source with timestamp citation. Source and attachment persistence is atomic and capture retries are idempotent. Export/import preserves media and readable Markdown/HTML citations.

No new player/extractor dependencies were added. Browser-native decoding/encoding and Node built-ins underpin Spire-owned implementation. MP4, WebM and Ogg support depends on browser codecs. Local originals are not uploaded. Public links use authenticated, device-bound expiring playback tickets, public-IP/DNS checks, redirect validation and bounded streams. Arbitrary pages, protected streams and DRM are not guaranteed playable. Unknown creators stay blank; users review attribution.

Desktop Record video tab is an explicit browser-permission fallback. Stop recording, scrub the result and set the original-video start offset before capture. The selected tab can include surrounding UI; this is not automatic video extraction or DRM bypass. Physical browser permission-picker behavior is not proven by simulated-stream tests.

Verification: production build; 95/95 unit/API tests; 103/103 full browser regressions; six focused video tests including simulated desktop tab-stream recording. Real public MP4 resolution and byte-range streaming verified. A real YouTube page returned its title/channel but no playable feed, honestly offering the fallback. Android loads this shared hosted interface; existing file chooser supports local video selection. No native changes or replacement APK are needed. Physical Android/WebView acceptance remains unverified.

