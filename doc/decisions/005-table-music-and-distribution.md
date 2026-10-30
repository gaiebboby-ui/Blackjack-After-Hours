# ADR-005: Table music and verified distributions

Date: 2026-10-30. Status: accepted.

The fifteen-minute composition was generated but never copied to runtime assets. Only the title theme had a player, which intentionally stopped when entering the table.

Use a dedicated HTMLAudioElement for the long table MP3, with lazy loading, looping and pause/resume at the same position. Keep the short title theme on its existing decoded-buffer player. Decoding the full long stereo score into Web Audio would allocate hundreds of megabytes on phones; streaming avoids that cost. Both players use the saved music level and the master sound setting. Visibility changes pause the table player. The table score is packaged for offline Android play.

Validate parsed saved data before treating it as an array or settings object. Parsing valid JSON does not guarantee the expected shape.

Generate project and dependency license copies during asset preparation, fail when a production dependency lacks a license text, and include these copies in both web and Android artifacts. Keep a reviewed copy of the colord MIT license because its npm package omits it. Native dependency coordinates are recorded during Gradle builds.

Signed builds require explicit credentials. Credential creation and backup remain separate from ordinary builds. Preserve the existing certificate if update compatibility is needed; do not silently rotate it. Android CI builds and runs instrumentation tests without production credentials. Account-level Pages and branch-protection restrictions remain explicit in documentation.
