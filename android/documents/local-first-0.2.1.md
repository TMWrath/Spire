# Local-first Android 0.2.1

Local folder selection is the default first-run action. No account or server is required. The user can create a folder using the Android picker. Server address/sign-in setup is hidden until **Connect to a server (optional)** is chosen; fresh installs no longer prefill a production server address. Existing server sessions remain intact.

All npm checks and Android test/lint/assembleDebug pass. The previously failing attachment test now follows the canonical raw-byte upload and attachment metadata response contracts; binary readback, reopening, templates, folders and portable ZIP contents pass. See build-verification.json for the signed artifact. Real-device SAF, IME and process-kill acceptance remain unperformed.
