from io import BytesIO
from pathlib import Path
import sys
import struct
import tempfile
import unittest
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'assets/cards'))
from layered_export import export_layers, packbits
from build_deck import load_psd_masters

class LayeredExportTests(unittest.TestCase):
    def test_packbits_edge_cases(self):
        for data in (bytes(range(256)) * 2, bytes(512), bytes([7]) * 129 + bytes(range(128)), b'ab' * 256):
            result = Image.frombytes('L', (len(data), 1), packbits(data), 'packbits', 'L')
            self.assertEqual(result.tobytes(), data)

    def test_real_editor_layers_and_merged_transparency(self):
        images = (Image.new('RGBA', (9, 7), (25, 30, 40, 255)), Image.new('RGBA', (9, 7), (200, 90, 10, 80)))
        expected = Image.alpha_composite(*images)
        with tempfile.TemporaryDirectory() as folder:
            export_layers(Path(folder), 'sample', images, ('Paper', 'Art'))
            with Image.open(Path(folder) / 'sample.psd') as psd:
                self.assertEqual(psd.convert('RGBA').tobytes(), expected.tobytes())
                self.assertEqual(psd.n_frames, 2)
                raw = (Path(folder) / 'sample.psd').read_bytes()
                # Read PSD layer records by the file format, not Pillow's private
                # tile offsets, whose meaning changed between Pillow versions.
                cursor = 26
                for _ in range(2):  # colour-mode data and image resources
                    length = struct.unpack_from('>I', raw, cursor)[0]
                    cursor += 4 + length
                cursor += 8  # layer/mask section length and layer-info length
                count = abs(struct.unpack_from('>h', raw, cursor)[0])
                cursor += 2
                self.assertEqual(count, len(images))
                records = []
                for _ in range(count):
                    top, left, bottom, right, channel_count = struct.unpack_from('>4iH', raw, cursor)
                    cursor += 18
                    self.assertEqual((right-left, bottom-top), images[0].size)
                    self.assertEqual(channel_count, 4)
                    channels = []
                    for _ in range(channel_count):
                        channels.append(struct.unpack_from('>hI', raw, cursor))
                        cursor += 6
                    self.assertEqual({c[0] for c in channels}, {0, 1, 2, -1})
                    self.assertEqual(raw[cursor:cursor+8], b'8BIMnorm')
                    extra_size = struct.unpack_from('>I', raw, cursor+12)[0]
                    cursor += 16 + extra_size
                    records.append(channels)
                channel_names = {0: 'R', 1: 'G', 2: 'B', -1: 'A'}
                for channels, original in zip(records, reversed(images)):
                    for channel_id, length in channels:
                        self.assertEqual(struct.unpack_from('>H', raw, cursor)[0], 1)
                        row_lengths = struct.unpack_from(f'>{original.height}H', raw, cursor+2)
                        start = cursor + 2 + 2*original.height
                        self.assertEqual(sum(row_lengths), length-2-2*original.height)
                        channel = Image.frombytes('L', original.size, raw[start:cursor+length], 'packbits', 'L')
                        self.assertEqual(channel.tobytes(), original.getchannel(channel_names[channel_id]).tobytes())
                        cursor += length
            with ZipFile(Path(folder) / 'sample.ora') as archive:
                self.assertEqual(archive.namelist()[0], 'mimetype')
                records = ET.fromstring(archive.read('stack.xml')).findall('./stack/layer')
                self.assertEqual([r.get('name') for r in records], ['Art', 'Paper'])
                for record, original in zip(records, reversed(images)):
                    with Image.open(BytesIO(archive.read(record.get('src')))) as image:
                        self.assertEqual(image.tobytes(), original.tobytes())
                with Image.open(BytesIO(archive.read('mergedimage.png'))) as image:
                    self.assertEqual(image.tobytes(), expected.tobytes())

    def test_psd_import_uses_saved_merged_image(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            layers = (Image.new('RGBA', (512, 716), (20, 30, 40, 255)), Image.new('RGBA', (512, 716), (200, 90, 10, 80)))
            export_layers(root, 'queen_of_spades', layers, ('Paper', 'Art'))
            masters = load_psd_masters(root)
            self.assertEqual(set(masters), {'queen_of_spades'})
            self.assertEqual(masters['queen_of_spades'][0].tobytes(), Image.alpha_composite(*layers).tobytes())
            self.assertEqual(masters['queen_of_spades'][1], (root / 'queen_of_spades.psd').resolve())

    def test_psd_import_rejects_invalid_sources_before_export(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            layers = (Image.new('RGBA', (9, 7), (20, 30, 40, 255)),)
            export_layers(root, 'queen_of_spades', layers, ('Art',))
            with self.assertRaisesRegex(ValueError, '512x716'):
                load_psd_masters(root)
            (root / 'queen_of_spades.psd').rename(root / 'not-a-card.psd')
            with self.assertRaisesRegex(ValueError, 'Unknown card'):
                load_psd_masters(root)

if __name__ == '__main__':
    unittest.main()
