# Winning lip smirk

Frames 7 and 14 now change only the lower muzzle relative to the neutral portrait. Frame 14 is the intermediate expression. Head rotation has been removed; the existing interruptible pose blend uses 220 ms on entry and 320 ms on return.

The generated source is preserved as smirk-generated-source.png. Only its lip line is integrated into the original portrait; head, eyes, glasses, silhouette and alpha remain fixed. Previous frames are preserved in before-lip-smirk/.

Validation: changed pixel bounds x209–254, y280–304; original alpha preserved; 32 tests pass; production build passes. Preview: artifacts/animation-preview/lip-smirk.gif.
