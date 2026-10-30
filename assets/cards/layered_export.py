"""Layered card masters using only Pillow and the Python standard library.

PSD: 8-bit RGBA, normal blend, PackBits channels, full-size pixel layers.
ORA: named PNG layers and an exact merged preview for Krita/GIMP.
"""
from io import BytesIO
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

from PIL import Image

LAYER_NAMES = ('01 Paper', '02 Decoration', '03 Portrait or pips', '04 Frame', '05 Rank and suit')
_RUN = re.compile(rb'(.)\1{2,127}', re.DOTALL)


def packbits(row: bytes) -> bytes:
    encoded = bytearray()
    cursor = 0
    for match in _RUN.finditer(row):
        start, end = match.span()
        for offset in range(cursor, start, 128):
            block = row[offset:min(offset + 128, start)]
            encoded.append(len(block) - 1)
            encoded.extend(block)
        encoded.extend((257 - (end - start), row[start]))
        cursor = end
    for offset in range(cursor, len(row), 128):
        block = row[offset:offset + 128]
        encoded.append(len(block) - 1)
        encoded.extend(block)
    return bytes(encoded)


def channel_data(channel: Image.Image) -> bytes:
    width, height = channel.size
    pixels = channel.tobytes()
    rows = [packbits(pixels[y * width:(y + 1) * width]) for y in range(height)]
    # PackBits 128 is a no-op; align channel boundaries for PSD readers.
    if sum(map(len, rows)) % 2:
        rows[-1] += b'\x80'
    return struct.pack('>H', 1) + struct.pack(f'>{height}H', *(len(row) for row in rows)) + b''.join(rows)


def export_layers(destination: Path, stem: str, layers: tuple[Image.Image, ...], names: tuple[str, ...] = LAYER_NAMES) -> None:
    """Export the actual composition, not a flattened image duplicated into layers."""
    destination.mkdir(parents=True, exist_ok=True)
    width, height = layers[0].size
    if len(layers) != len(names) or any(layer.mode != 'RGBA' or layer.size != (width, height) for layer in layers):
        raise ValueError('Expected named, equally sized RGBA source layers')
    merged = Image.new('RGBA', (width, height))
    for layer in layers:
        merged.alpha_composite(layer)

    records, pixels = [], []
    # Both editor formats store the topmost layer first.
    for name, layer in reversed(tuple(zip(names, layers))):
        channels = [channel_data(channel) for channel in layer.split()]
        label = name.encode('ascii')[:255]
        pascal = bytes([len(label)]) + label
        pascal += b'\0' * (-len(pascal) % 4)
        extra = struct.pack('>II', 0, 0) + pascal
        record = struct.pack('>4iH', 0, 0, height, width, 4)
        record += b''.join(struct.pack('>hI', index, len(data)) for index, data in zip((0, 1, 2, -1), channels))
        record += b'8BIMnorm' + bytes((255, 0, 0, 0)) + struct.pack('>I', len(extra)) + extra
        records.append(record)
        pixels.extend(channels)
    # Negative count indicates that the merged image includes transparency.
    layer_info = struct.pack('>h', -len(layers)) + b''.join(records) + b''.join(pixels)
    layer_info += b'\0' * (len(layer_info) % 2)
    layer_section = struct.pack('>I', len(layer_info)) + layer_info + struct.pack('>I', 0)
    header = b'8BPS' + struct.pack('>H6sHIIHH', 1, b'\0' * 6, 4, height, width, 8, 3)
    with (destination / f'{stem}.psd').open('wb') as output:
        output.write(header + struct.pack('>II', 0, 0))
        output.write(struct.pack('>I', len(layer_section)) + layer_section)
        output.write(struct.pack('>H', 0))
        for channel in merged.split():
            output.write(channel.tobytes())

    image = ET.Element('image', {'version': '0.0.3', 'w': str(width), 'h': str(height), 'name': stem})
    stack = ET.SubElement(image, 'stack')
    with ZipFile(destination / f'{stem}.ora', 'w', compression=ZIP_DEFLATED) as archive:
        archive.writestr('mimetype', 'image/openraster', compress_type=ZIP_STORED)
        for index in reversed(range(len(layers))):
            filename = f'data/layer-{index + 1}.png'
            ET.SubElement(stack, 'layer', {'name': names[index], 'src': filename, 'x': '0', 'y': '0', 'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
            data = BytesIO()
            layers[index].save(data, format='PNG')
            archive.writestr(filename, data.getvalue())
        data = BytesIO()
        merged.save(data, format='PNG')
        archive.writestr('mergedimage.png', data.getvalue())
        merged.thumbnail((256, 256), Image.Resampling.LANCZOS)
        data = BytesIO()
        merged.save(data, format='PNG')
        archive.writestr('Thumbnails/thumbnail.png', data.getvalue())
        archive.writestr('stack.xml', ET.tostring(image, encoding='utf-8', xml_declaration=True))
