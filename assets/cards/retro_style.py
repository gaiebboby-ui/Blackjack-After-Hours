"""Compose the five generated source assets; no image generation at build time."""
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 512, 716
GOLD = '#B68A42'
LAYERS = Path(__file__).resolve().parent / 'layers'
DECORATIONS = {
    'number': ('03-number-halo.png', (290, 399), (376, 472)),
    'ace': ('04-ace-halo.png', (290, 397), (386, 514)),
    'court': ('05-court-medallion.png', (296, 410), (368, 506)),
}


@lru_cache(maxsize=5)
def source_layer(name):
    with Image.open(LAYERS / name) as source:
        image = source.convert('RGBA')
    alpha = image.getchannel('A')
    if name != '01-paper.png' and alpha.getextrema() != (0, 255):
        raise ValueError(f'{name} must contain real transparency and opaque print')
    return image


@lru_cache(maxsize=1)
def paper_layer():
    image = source_layer('01-paper.png').resize((W, H), Image.Resampling.LANCZOS)
    # Paper stops underneath the generated outer frame. Supersample its silhouette.
    mask = Image.new('L', (W * 3, H * 3))
    ImageDraw.Draw(mask).rounded_rectangle((14*3, 14*3, 498*3, 702*3), radius=27*3, fill=255)
    image.putalpha(mask.resize((W, H), Image.Resampling.LANCZOS))
    return image


@lru_cache(maxsize=1)
def frame_layer():
    return source_layer('02-frame.png').resize((W, H), Image.Resampling.LANCZOS)


@lru_cache(maxsize=3)
def decoration_layer(kind):
    name, center, bounds = DECORATIONS[kind]
    source = source_layer(name)
    # Normalize differing transparent margins using explicit shared placements.
    bbox = source.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    if bbox is None:
        raise ValueError(f'{name} is empty')
    source = source.crop(bbox)
    source.thumbnail(bounds, Image.Resampling.LANCZOS)
    layer = Image.new('RGBA', (W, H))
    layer.alpha_composite(source, (center[0] - source.width // 2, center[1] - source.height // 2))
    return layer


def assembly_layers(kind):
    """Return independent full-card layers in their compositing order."""
    return (paper_layer(), decoration_layer(kind), frame_layer())


@lru_cache(maxsize=3)
def template(kind):
    image = Image.new('RGBA', (W, H))
    for layer in assembly_layers(kind):
        image.alpha_composite(layer)
    return image
