"""Export available art sources without inventing layers inside flat artwork."""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'assets/cards'))
from layered_export import export_layers

out = ROOT / 'assets/editable/generated'
for stem, source in (
    ('table', 'assets/scene/blackjack-table.png'),
    ('bet-token', 'assets/sprites/bet-token.png'),
    ('card-back', 'assets/cards/card-back-master.png'),
    ('dealer-animation-sheet', 'assets/dealer/dealer-animation-rows — копия.png'),
):
    with Image.open(ROOT / source) as image:
        export_layers(out, stem, (image.convert('RGBA'),), ('Original raster artwork',))
base = Image.open(ROOT / 'assets/dealer/v3/frame-0.png').convert('RGBA')
for index in range(16):
    face = Image.open(ROOT / f'assets/dealer/v3/face-{index}.png').convert('RGBA')
    export_layers(out / 'dealer', f'pose-{index:02}', (base, face), ('01 Dealer base', '02 Expression'))
print(f'Editable art sources: {out}')
