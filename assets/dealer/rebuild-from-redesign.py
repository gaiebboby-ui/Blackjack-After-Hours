"""Rebuild dealer pose assets and previews from the updated animation-row PNG.

The input is a 9-column, 6-row (418 px per cell) transparent atlas. Existing
v3 frame and face files are backed up once before replacement.
Requires Pillow.
"""
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
V3 = ROOT / "v3"
SOURCE = ROOT / "dealer-animation-rows — копия.png"
BACKUP = V3 / "before-red-design"
CELL = 418

# Frame ID -> (cell column, cell row) in the user-updated animation rows.
CELLS = {
    0: (0, 0),
    1: (2, 2), 2: (4, 2), 3: (6, 2),
    4: (0, 5), 5: (1, 5), 6: (2, 5),
    7: (2, 3), 8: (2, 4),
    9: (1, 2), 10: (3, 2), 11: (5, 2),
    12: (3, 5), 13: (4, 5),
    14: (1, 3), 15: (1, 4),
}

sheet = Image.open(SOURCE).convert("RGBA")
expected = (9 * CELL, 6 * CELL)
if sheet.size != expected:
    raise ValueError(f"Expected source sheet {expected}, got {sheet.size}")

BACKUP.mkdir(exist_ok=True)
for path in [*(V3 / f"frame-{i}.png" for i in range(16)), *(V3 / f"face-{i}.png" for i in range(16))]:
    saved = BACKUP / path.name
    if path.exists() and not saved.exists():
        shutil.copy2(path, saved)

old_masks = {i: Image.open(V3 / f"face-{i}.png").convert("RGBA").getchannel("A") for i in range(16)}
frames = []
for i, (column, row) in CELLS.items():
    pose = sheet.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL))
    # Keep the game's shared silhouette and facial-layer mask architecture.
    # The full pose updates frame art; the matching mask limits face overlays.
    frame_path = V3 / f"frame-{i}.png"
    pose.save(frame_path, optimize=True)
    face = pose.copy()
    face.putalpha(old_masks[i])
    face.save(V3 / f"face-{i}.png", optimize=True)
    frames.append(pose)

assert len(frames) == 16 and all(frame.size == (CELL, CELL) for frame in frames)

# Refresh current visual previews from the rebuilt poses.
contact = Image.new("RGBA", (4 * CELL, 4 * CELL), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    contact.alpha_composite(frame, ((i % 4) * CELL, (i // 4) * CELL))
contact.save(V3 / "contact-sheet.png", optimize=True)

def preview(order, durations, path):
    rendered, times = [], []
    for j, index in enumerate(order):
        previous = frames[order[j - 1]] if j else frames[index]
        duration = durations[j]
        fade = min(50, duration)
        steps = max(1, min(5, duration // 10))
        for k in range(1, steps + 1):
            t = k / steps
            t = t * t * (3 - 2 * t)
            pose = Image.blend(previous, frames[index], t)
            bg = Image.new("RGBA", (CELL, CELL), "#081b13")
            bg.alpha_composite(pose)
            rendered.append(bg.convert("RGB"))
            times.append(max(10, fade // steps))
        if duration > fade:
            rendered.append(rendered[-1])
            times.append(duration - fade)
    rendered[0].save(path, save_all=True, append_images=rendered[1:], duration=times, loop=0, disposal=2)


preview(
    [0, 9, 1, 10, 2, 11, 3, 9, 0, 14, 7, 14, 0, 15, 8, 15, 0],
    [1200, 25, 30, 25, 50, 25, 30, 25, 1200, 180, 800, 180, 700, 180, 800, 180, 1400],
    V3 / "dealer-preview.gif",
)
idle_order = [0, 9, 1, 10, 2, 11, 3, 9, 0]
idle_durations = [1600, 25, 30, 25, 50, 25, 30, 25, 1800]
idle = []
for index in idle_order:
    bg = Image.new("RGBA", (CELL, CELL), "#081b13")
    bg.alpha_composite(frames[index])
    idle.append(bg.convert("RGB"))
idle[0].save(V3 / "idle-preview.gif", save_all=True, append_images=idle[1:], duration=idle_durations, loop=0, disposal=2)

for name, half, full in [("player-win", 15, 8), ("player-lose", 14, 7)]:
    timeline = [(0, 0), (100, half), (280, full), (1000, half), (1180, full), (1800, half), (2150, 0)]
    poses, times = [], []
    for time in range(0, 2800, 20):
        index = max(i for i, (at, _) in enumerate(timeline) if at <= time)
        at, current = timeline[index]
        old = timeline[max(0, index - 1)][1]
        t = min(1, (time - at) / 50)
        t = t * t * (3 - 2 * t)
        pose = Image.blend(frames[old], frames[current], t)
        bg = Image.new("RGBA", (CELL, CELL), "#081b13")
        bg.alpha_composite(pose)
        poses.append(bg.convert("RGB"))
        times.append(20)
    palette = poses[30].quantize(colors=256)
    poses = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in poses]
    poses[0].save(V3 / f"{name}-reaction.gif", save_all=True, append_images=poses[1:], duration=times, loop=0, disposal=2)

print(f"Rebuilt 16 frame/face pairs from {SOURCE.name}; saved original assets under {BACKUP.relative_to(ROOT)}")
print("Refreshed v3 contact sheet and all dealer preview GIFs")
