# Quick Format

the project owner requested typed formatting shortcuts that activate on Space and stop on Enter. Aphelion proposed the italic/strike/underline aliases, active indicator and code protection; the project owner approved implementation.

In the visual **Editor**, type `@bld`, `@itl`, `@stk` or `@und` followed by Space. The command and triggering Space disappear; subsequent typing receives bold, italic, strikethrough or underline. Enter (including line break and mobile beforeinput paragraph/line-break events) clears quick-activated marks while preserving text already authored. An active indicator names the styles. Exact whitespace-delimited tokens only; email-like text, unknown commands, escaped tokens, pasted shortcuts and code stay literal. Content reloads reset transient activation.

Saved source uses ordinary Markdown bold/italic/strike and portable `<u>` HTML for underline. Raw **Source** mode remains literal; quick formatting is a visual Editor input feature, not a source-text rewrite engine.

Verification: production build, 91 unit/API tests, focused quick-format browser test and complete 97-test browser suite passed. Browser coverage exercises all four styles, exact persisted source, Enter reset, code/unknown-token protection, narrow-screen containment, simulated mobile beforeinput and save/reload. Real Android IME/device testing is not claimed.

Live deployment verified at https://spire.example: running candidate image, healthy service, immutable release labels and existing read-write data volume confirmed; served HTML/JS/CSS match the tested build byte-for-byte. Application and full-volume backups passed verification and checksums; rollback image retained. Source push not authorized. Physical Android IME testing remains unverified.
