from __future__ import annotations

import json
import math
import argparse
import os
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont
from layered_export import export_layers
from retro_style import template, assembly_layers, GOLD


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "faces"
COURT = ROOT / "court"
W, H = 512, 716
PAD = 16
SUITS = ["hearts", "diamonds", "clubs", "spades"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
RANK_FILE = {"A": "ace", "J": "jack", "Q": "queen", "K": "king"}
RANK_VALUE = {"A": 1, **{str(n): n for n in range(2, 11)}, "J": 10, "Q": 10, "K": 10}

# Every suit gets its own named court portrait. Keep this mapping as data so
# face generation and the runtime manifest cannot silently disagree.
COURT_CAST = {
    ("J", "hearts"): ("P-21", "jack-p21.png"),
    ("J", "diamonds"): ("Zodiac Leo", "jack-zodiac-leo.png"),
    ("J", "clubs"): ("Rover", "jack-rover.png"),
    ("J", "spades"): ("Lancer", "jack-lancer.png"),
    ("Q", "hearts"): ("Morning Glory", "queen-morning-glory.png"),
    ("Q", "diamonds"): ("Psycho-Shy", "queen-psycho-shy.png"),
    ("Q", "clubs"): ("Rampage", "queen-rampage.png"),
    ("Q", "spades"): ("Blackjack", "queen-blackjack.png"),
    ("K", "hearts"): ("Goldenblood", "king-goldenblood.png"),
    ("K", "diamonds"): ("Steel Rain", "king-steel-rain.png"),
    ("K", "clubs"): ("Deus", "king-deus.png"),
    ("K", "spades"): ("Light Hooves", "king-light-hooves.png"),
}

INK = "#00150F"
DEEP = "#00412C"
MID = "#008F56"
PHOSPHOR = "#00D882"
LIME = "#00FB97"
PAPER = "#C9F9E1"
PAPER_LIGHT = "#E2FFF0"

FONT_REG = Path(r"C:\Windows\Fonts\georgia.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\georgiab.ttf")
FONT_SUITS = Path(r"C:\Windows\Fonts\seguisym.ttf")
SUIT_GLYPHS = {"hearts": "♥", "diamonds": "♦", "clubs": "♣", "spades": "♠"}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(str(path), size)


def cubic(a, b, c, d, steps=18):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        pts.append((
            u**3 * a[0] + 3 * u**2 * t * b[0] + 3 * u * t**2 * c[0] + t**3 * d[0],
            u**3 * a[1] + 3 * u**2 * t * b[1] + 3 * u * t**2 * c[1] + t**3 * d[1],
        ))
    return pts


def heart_points(box):
    x, y, w, h = box
    scale = lambda p: (x + p[0] * w, y + p[1] * h)
    segs = [
        cubic((.5, .91), (.43, .83), (.08, .55), (.08, .34)),
        cubic((.08, .34), (.08, .08), (.41, .04), (.5, .27)),
        cubic((.5, .27), (.59, .04), (.92, .08), (.92, .34)),
        cubic((.92, .34), (.92, .55), (.57, .83), (.5, .91)),
    ]
    return [scale(p) for seg in segs for p in seg]


def draw_legacy_suit(draw: ImageDraw.ImageDraw, suit: str, box, fill, outline=INK, width=2):
    x, y, w, h = box
    if suit == "hearts":
        points = heart_points(box)
        draw.polygon(points, fill=fill)
        if width:
            draw.line(points + [points[0]], fill=outline, width=width, joint="curve")
    elif suit == "diamonds":
        pts = [(x + w * .5, y), (x + w, y + h * .5), (x + w * .5, y + h), (x, y + h * .5)]
        draw.polygon(pts, fill=fill)
        if width:
            draw.line(pts + [pts[0]], fill=outline, width=width, joint="curve")
    elif suit == "spades":
        heart = heart_points((x, y + h * .02, w, h * .75))
        pts = [(x + w * .5, y + h * .02)] + [(2 * (x + w * .5) - px, 2 * (y + h * .42) - py) for px, py in heart]
        draw.polygon(pts, fill=fill)
        stem = [(x + w * .43, y + h * .61), (x + w * .57, y + h * .61), (x + w * .68, y + h), (x + w * .32, y + h)]
        draw.polygon(stem, fill=fill)
        if width:
            draw.line(pts + [pts[0]], fill=outline, width=width, joint="curve")
            draw.line(stem + [stem[0]], fill=outline, width=width, joint="curve")
    else:  # clubs
        r = min(w, h) * .27
        cx, cy = x + w * .5, y + h * .34
        lobes = [(cx, cy - r * .7), (cx - r * .9, cy + r * .45), (cx + r * .9, cy + r * .45)]
        for lx, ly in lobes:
            draw.ellipse((lx - r, ly - r, lx + r, ly + r), fill=fill, outline=outline, width=width)
        stem = [(cx - r * .25, cy + r * .6), (cx + r * .25, cy + r * .6), (cx + r * .72, y + h), (cx - r * .72, y + h)]
        draw.polygon(stem, fill=fill)
        if width:
            draw.line(stem + [stem[0]], fill=outline, width=width, joint="curve")


def draw_suit(draw: ImageDraw.ImageDraw, suit: str, box, fill, outline=INK, width=2):
    """Use standard Unicode suit silhouettes, not custom approximations."""
    x, y, w, h = box
    glyph = SUIT_GLYPHS[suit]
    size = 100
    suit_font = ImageFont.truetype(str(FONT_SUITS), size)
    bounds = draw.textbbox((0, 0), glyph, font=suit_font)
    size = max(1, int(size * min(w / (bounds[2] - bounds[0]), h / (bounds[3] - bounds[1]))))
    suit_font = ImageFont.truetype(str(FONT_SUITS), size)
    bounds = draw.textbbox((0, 0), glyph, font=suit_font)
    position = (x + (w - bounds[2] + bounds[0]) / 2 - bounds[0],
                y + (h - bounds[3] + bounds[1]) / 2 - bounds[1])
    draw.text(position, glyph, font=suit_font, fill=fill,
              stroke_width=width if outline != fill else 0, stroke_fill=outline)


def suit_colors(suit):
    if suit in ("hearts", "diamonds"):
        return "#8B203B", "#8B203B"
    return INK, INK


def add_corner(card: Image.Image, rank: str, suit: str):
    block = Image.new("RGBA", (180, 274), (0, 0, 0, 0))
    d = ImageDraw.Draw(block)
    ink, _ = suit_colors(suit)
    size = 128 if rank != "10" else 112
    f = font(size, bold=True)
    bbox = d.textbbox((0, 0), rank, font=f, stroke_width=0)
    d.text(((180 - (bbox[2] - bbox[0])) / 2 - bbox[0], 0 - bbox[1]), rank, font=f, fill=ink)
    sf, so = suit_colors(suit)
    draw_suit(d, suit, (51, 117 if rank == "10" else 133, 72, 78), sf, so, 2)
    card.alpha_composite(block, (23, 42))


PIP_POSITIONS = {
    2: [(290, 280), (290, 560)],
    3: [(290, 280), (290, 420), (290, 560)],
    4: [(210, 280), (370, 280), (210, 560), (370, 560)],
    5: [(210, 280), (370, 280), (290, 420), (210, 560), (370, 560)],
    6: [(210, 280), (370, 280), (210, 420), (370, 420), (210, 560), (370, 560)],
    7: [(210, 280), (370, 280), (290, 350), (210, 420), (370, 420), (210, 560), (370, 560)],
    8: [(210, 280), (370, 280), (290, 350), (210, 420), (370, 420), (290, 490), (210, 560), (370, 560)],
    9: [(210, 280), (370, 280), (210, 373), (370, 373), (290, 420), (210, 467), (370, 467), (210, 560), (370, 560)],
    10: [(210, 280), (370, 280), (290, 326), (210, 373), (370, 373), (210, 467), (370, 467), (290, 514), (210, 560), (370, 560)],
}


def fit_portrait(name: str, width: int, height: int) -> Image.Image:
    source = Image.open(COURT / name).convert("RGBA")
    alpha = source.getchannel("A")
    # Ignore faint generator noise outside the visible portrait when fitting art.
    bbox = alpha.point(lambda v: 255 if v > 16 else 0).getbbox()
    if bbox:
        source = source.crop(bbox)
    # These are head-and-neck portraits. Preserve complete ears, mane and helmets.
    source.thumbnail((width, height), Image.Resampling.LANCZOS)
    return source


def draw_court(card: Image.Image, rank: str, suit: str):
    _, portrait_name = COURT_CAST[(rank, suit)]
    # Keep complete silhouettes inside the shared ornamental medallion.
    art = fit_portrait(portrait_name, 316, 440)
    pos = (138 + (316 - art.width) // 2, 190 + (440 - art.height) // 2)
    card.alpha_composite(art, pos)


def make_court_preview():
    cell_w, cell_h, margin = 300, 352, 90
    preview = Image.new("RGB", (margin * 2 + cell_w * 4, margin * 2 + cell_h * 3 + 42), "#06140F")
    draw = ImageDraw.Draw(preview)
    label_font = font(16)
    heading_font = font(18, bold=True)
    suit_names = {"hearts": "HEARTS", "diamonds": "DIAMONDS", "clubs": "CLUBS", "spades": "SPADES"}
    rank_names = {"J": "JACK", "Q": "QUEEN", "K": "KING"}

    for col, suit in enumerate(SUITS):
        x = margin + col * cell_w
        draw.text((x + 10, margin - 22), suit_names[suit], font=heading_font, fill=PAPER)
    for row, rank in enumerate(("J", "Q", "K")):
        y = margin + 28 + row * cell_h
        draw.text((10, y + 12), rank_names[rank], font=heading_font, fill=PHOSPHOR)
        for col, suit in enumerate(SUITS):
            x = margin + col * cell_w
            draw.rounded_rectangle((x, y, x + cell_w - 16, y + cell_h - 12), radius=14, fill=PAPER, outline=PHOSPHOR, width=2)
            character, portrait_name = COURT_CAST[(rank, suit)]
            art = fit_portrait(portrait_name, 230, 270)
            pos = (x + (cell_w - 16 - art.width) // 2, y + 15 + (270 - art.height) // 2)
            preview.paste(art, pos, art)
            draw = ImageDraw.Draw(preview)
            label = character.upper()
            bbox = draw.textbbox((0, 0), label, font=label_font)
            draw.text((x + (cell_w - 16 - (bbox[2] - bbox[0])) // 2, y + cell_h - 50), label, font=label_font, fill=INK)

    preview.save(COURT / "court-portraits-preview.png", optimize=True)


def print_ink(layer: Image.Image) -> Image.Image:
    """Give programmatic indices and pips subtle repeatable worn print grain."""
    mask = Image.new('L', (W, H), 255)
    draw = ImageDraw.Draw(mask)
    rng = random.Random(20261030)
    for _ in range(1800):
        draw.point((rng.randrange(W), rng.randrange(H)), fill=rng.randrange(125, 230))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), mask))
    return layer


def card_layers(rank: str, suit: str):
    """Five actual per-card layers: paper, decor, subject, frame, index."""
    kind = 'ace' if rank == 'A' else 'number' if rank.isdigit() else 'court'
    paper, decoration, frame = assembly_layers(kind)
    subject = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(subject)
    fill, outline = suit_colors(suit)
    if rank == "A":
        draw_suit(d, suit, (181, 264, 218, 262), fill, GOLD, 2)
    elif rank.isdigit():
        size = 76 if int(rank) <= 6 else 66
        for x, y in PIP_POSITIONS[int(rank)]:
            box = (x - size / 2, y - size / 2, size, size)
            draw_suit(d, suit, box, fill, outline, 2)
    else:
        draw_court(subject, rank, suit)
    if rank not in ('J', 'Q', 'K'):
        subject = print_ink(subject)
    index = Image.new('RGBA', (W, H))
    add_corner(index, rank, suit)
    return (paper, decoration, subject, frame, print_ink(index))


def make_card(rank: str, suit: str) -> Image.Image:
    card = Image.new('RGBA', (W, H))
    for layer in card_layers(rank, suit):
        card.alpha_composite(layer)
    return card


def load_psd_masters(folder: Path):
    """Read the editor-saved merged image, preserving masks and blend effects."""
    if not folder.is_dir():
        raise ValueError(f'PSD source directory does not exist: {folder}')
    expected = {f'{RANK_FILE.get(rank, rank)}_of_{suit}' for rank in RANKS for suit in SUITS}
    masters = {}
    for source in sorted(folder.glob('*.psd')):
        if source.stem not in expected:
            raise ValueError(f'Unknown card PSD filename: {source.name}')
        with Image.open(source) as image:
            if image.format != 'PSD' or image.size != (W, H):
                raise ValueError(f'{source.name}: expected a {W}x{H} PSD master')
            merged = image.convert('RGBA')
            if merged.getchannel('A').getbbox() is None:
                raise ValueError(f'{source.name}: merged image is fully transparent')
            masters[source.stem] = (merged, source.resolve())
    return masters


def make_face_previews(destination: Path, include_assembly=True):
    samples = [('7', 'hearts'), ('A', 'spades'), ('Q', 'spades')]
    trio = Image.new('RGB', (1072, 496), '#08241B')
    for col, (rank, suit) in enumerate(samples):
        card = Image.open(OUT / f'{RANK_FILE.get(rank, rank)}_of_{suit}.png').convert('RGBA')
        card.thumbnail((332, 464), Image.Resampling.LANCZOS)
        trio.paste(card, (16 + col * 352, 16), card)
    trio.save(destination / 'retro-style-preview.png', optimize=True)

    court = Image.new('RGB', (1048, 1122), '#08241B')
    for row, rank in enumerate(('J', 'Q', 'K')):
        for col, suit in enumerate(SUITS):
            card = Image.open(OUT / f'{RANK_FILE.get(rank, rank)}_of_{suit}.png').convert('RGBA')
            card.thumbnail((246, 344), Image.Resampling.LANCZOS)
            court.paste(card, (16 + col * 258, 16 + row * 368), card)
    court.save(destination / 'retro-court-preview.png', optimize=True)

    if not include_assembly:
        return

    # Real intermediate composites make the five-layer build easy to inspect.
    stages = Image.new('RGB', (1286, 1136), '#08241B')
    labels = ('1 PAPER', '2 DECOR', '3 SUBJECT', '4 FRAME', '5 INDEX')
    draw = ImageDraw.Draw(stages)
    for col, label in enumerate(labels):
        draw.text((16 + col * 254, 12), label, font=font(17, bold=True), fill=PAPER_LIGHT)
    for row, (rank, suit) in enumerate(samples):
        composite = Image.new('RGBA', (W, H))
        for col, layer in enumerate(card_layers(rank, suit)):
            composite.alpha_composite(layer)
            thumb = composite.resize((238, 333), Image.Resampling.LANCZOS)
            stages.paste(thumb, (16 + col * 254, 46 + row * 360), thumb)
    stages.save(destination / 'layer-assembly-preview.png', optimize=True)


def main():
    parser = argparse.ArgumentParser(description="Build a deck at a configurable export size.")
    parser.add_argument('--width', type=int, default=W)
    parser.add_argument('--height', type=int, default=H)
    parser.add_argument('--output', type=Path, default=ROOT)
    parser.add_argument('--no-editable', action='store_true', help='Skip PSD/ORA masters; existing masters are never overwritten')
    parser.add_argument('--from-psd', type=Path, help='Use saved PSD composites; defaults to editable/manual when present')
    args = parser.parse_args()
    if not (128 <= args.width <= 2048 and 180 <= args.height <= 2800):
        parser.error('Supported dimensions: width 128..2048, height 180..2800')
    source_dir = args.from_psd or ROOT / 'editable' / 'manual'
    masters = load_psd_masters(source_dir) if args.from_psd or source_dir.exists() else {}
    export_w, export_h = args.width, args.height
    # Keep master composition stable; output pixels and runtime size are independent.
    global OUT
    destination = args.output.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    OUT = destination / 'faces'
    OUT.mkdir(parents=True, exist_ok=True)
    template_dir = destination / 'templates'
    template_dir.mkdir(parents=True, exist_ok=True)
    for kind in ('number', 'ace', 'court'):
        template(kind).save(template_dir / f'retro-{kind}.png', optimize=True)
    make_court_preview()
    cell_w, cell_h = export_w + PAD, export_h + PAD
    atlas = Image.new("RGBA", (cell_w * len(RANKS), cell_h * len(SUITS)), (0, 0, 0, 0))
    frames = {}
    cards = []
    for row, suit in enumerate(SUITS):
        for col, rank in enumerate(RANKS):
            stem = f'{RANK_FILE.get(rank, rank)}_of_{suit}'
            if stem in masters:
                master = masters[stem][0]
            else:
                layers = card_layers(rank, suit)
                master = Image.new('RGBA', (W, H))
                for layer in layers:
                    master.alpha_composite(layer)
                if not args.no_editable:
                    export_layers(destination / 'editable' / 'generated', stem, layers)
            card = master.resize((export_w, export_h), Image.Resampling.LANCZOS)
            rank_name = RANK_FILE.get(rank, rank)
            filename = f"{rank_name}_of_{suit}.png"
            card.save(OUT / filename, optimize=True)
            x, y = col * cell_w + PAD // 2, row * cell_h + PAD // 2
            atlas.alpha_composite(card, (x, y))
            frames[filename] = {
                "frame": {"x": x, "y": y, "w": export_w, "h": export_h},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": export_w, "h": export_h},
                "sourceSize": {"w": export_w, "h": export_h},
            }
            card_entry = {"rank": rank, "value": RANK_VALUE[rank], "suit": suit, "file": f"faces/{filename}", "frame": filename}
            if (rank, suit) in COURT_CAST:
                character, portrait = COURT_CAST[(rank, suit)]
                card_entry["character"] = character
                card_entry["portrait"] = os.path.relpath(COURT / portrait, destination).replace('\\', '/')
            if stem in masters:
                card_entry['editableSource'] = os.path.relpath(masters[stem][1], destination).replace('\\', '/')
            cards.append(card_entry)

    atlas_file = "blackjack-deck-atlas.png"
    atlas.save(destination / atlas_file, optimize=True)
    sheet = {
        "frames": frames,
        "meta": {
            "app": "BlackJack pony deck sprite generator",
            "version": "1.0",
            "image": atlas_file,
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
        },
    }
    (destination / "blackjack-deck-atlas.json").write_text(json.dumps(sheet, indent=2), encoding="utf-8")

    atlas_dir = destination / "atlases"
    atlas_dir.mkdir(parents=True, exist_ok=True)
    suit_sheets = []
    suit_columns = min(7, max(1, 4096 // cell_w))
    suit_rows = math.ceil(len(RANKS) / suit_columns)
    for suit in SUITS:
        suit_atlas = Image.new("RGBA", (cell_w * suit_columns, cell_h * suit_rows), (0, 0, 0, 0))
        suit_frames = {}
        for index, rank in enumerate(RANKS):
            filename = f"{RANK_FILE.get(rank, rank)}_of_{suit}.png"
            col, row = index % suit_columns, index // suit_columns
            x, y = col * cell_w + PAD // 2, row * cell_h + PAD // 2
            card = Image.open(OUT / filename).convert("RGBA")
            suit_atlas.alpha_composite(card, (x, y))
            suit_frames[filename] = {
                "frame": {"x": x, "y": y, "w": export_w, "h": export_h},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": export_w, "h": export_h},
                "sourceSize": {"w": export_w, "h": export_h},
            }
        image_name = f"{suit}-atlas.png"
        suit_atlas.save(atlas_dir / image_name, optimize=True)
        atlas_metadata = {
            "frames": suit_frames,
            "meta": {
                "app": "BlackJack pony deck sprite generator",
                "version": "1.0",
                "image": image_name,
                "format": "RGBA8888",
                "size": {"w": suit_atlas.width, "h": suit_atlas.height},
                "scale": "1",
            },
        }
        json_name = f"{suit}-atlas.json"
        (atlas_dir / json_name).write_text(json.dumps(atlas_metadata, indent=2), encoding="utf-8")
        suit_sheets.append({"suit": suit, "image": f"atlases/{image_name}", "frames": f"atlases/{json_name}"})

    (destination / "suit-atlases.json").write_text(json.dumps({"atlases": suit_sheets}, indent=2), encoding="utf-8")
    deck = {
        "name": "BlackJack retro casino deck",
        "cardSize": {"width": export_w, "height": export_h},
        "suits": SUITS,
        "ranks": RANKS,
        "count": len(cards),
        "back": os.path.relpath(destination / 'card-back.png', destination).replace('\\', '/'),
        "cards": cards,
    }
    (destination / "deck-manifest.json").write_text(json.dumps(deck, indent=2), encoding="utf-8")
    back_path = ROOT / 'card-back.png'
    if back_path.exists() and destination != ROOT:
        Image.open(back_path).resize((export_w, export_h), Image.Resampling.LANCZOS).save(destination / 'card-back.png')

    thumb_w, thumb_h, gap, margin = 100, 140, 8, 16
    preview = Image.new(
        "RGB",
        (margin * 2 + len(RANKS) * (thumb_w + gap), margin * 2 + len(SUITS) * (thumb_h + gap)),
        "#05120D",
    )
    for row, suit in enumerate(SUITS):
        for col, rank in enumerate(RANKS):
            filename = f"{RANK_FILE.get(rank, rank)}_of_{suit}.png"
            thumb = Image.open(OUT / filename).convert("RGBA")
            thumb.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            x = margin + col * (thumb_w + gap) + (thumb_w - thumb.width) // 2
            y = margin + row * (thumb_h + gap) + (thumb_h - thumb.height) // 2
            preview.paste(thumb, (x, y), thumb)
    preview.save(destination / "blackjack-deck-preview.png", optimize=True)
    make_face_previews(destination, include_assembly=not masters)
    print(f'Deck exported: {len(masters)} PSD masters, {52-len(masters)} procedural cards')


if __name__ == "__main__":
    main()
