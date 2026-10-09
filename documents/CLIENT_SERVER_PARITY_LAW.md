# Spire Project Law: Client/Server Parity

Established by the project owner as a permanent project requirement.

Every Spire change must reflect on both the hosted server and Android client. They are one product with two delivery surfaces.

- Canonical hosted source: `/workspace/spire`.
- Canonical Android source: `/workspace/spire-android`.
- Inspect the impact of every change on both surfaces; implement necessary shared, server, and native changes.
- Verify behavior and compatibility on both before claiming completion. Record evidence and outstanding gates for each surface.
- Hosted UI changes may reach Android through the server-provided interface; do not manufacture redundant native edits or unchanged APKs. Verify that propagation and compatibility.
- Native changes require a rebuilt, signed, verified APK and applicable delivery.
- Browser simulation is not physical Android WebView acceptance. Unavailable device verification remains explicitly pending.
- Never call affected work complete with one surface left behind.
- This rule does not grant blanket authorization for pushing, deploying, or device access.
- Only the project owner may amend or revoke this project law.
