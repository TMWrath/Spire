> Source consolidation: this native Windows implementation now lives inside the single Spire repository at `windows/`. The former standalone repository is historical. See [canonical layout](../documents/source-layout.md).

# Spire Windows

Native standalone Windows port of Spire. Independent local workspace; optional synchronization with the existing hosted server. No Docker, embedded browser or local HTTP server in the product architecture.

Initial foundation only; not feature-complete or runtime-verified. Selected direction: C#/.NET with WPF native Windows UI and a toolkit-independent domain layer. Keep API snapshots lossless while progressively introducing validated typed models.

Canonical reference source: `/workspace/spire`. Do not modify or deploy the hosted project as part of bootstrap.
