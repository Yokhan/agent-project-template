"""
Decode pixel-agents PNG sprites into JSON color grids.
Output: n8n/dashboard/sprites.json — all sprites as hex color arrays.
Usage: python scripts/decode-sprites.py
"""
import json
import os
import struct
import zlib
from pathlib import Path

ASSETS = Path('n8n/dashboard/assets')
OUTPUT = Path('n8n/dashboard/sprites.json')


def decode_png(filepath):
    """Minimal PNG decoder → list of [r,g,b,a] rows."""
    with open(filepath, 'rb') as f:
        sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'Not a PNG: {filepath}')

        width = height = bit_depth = color_type = 0
        idat_chunks = []

        while True:
            chunk_len = struct.unpack('>I', f.read(4))[0]
            chunk_type = f.read(4)
            chunk_data = f.read(chunk_len)
            f.read(4)  # CRC

            if chunk_type == b'IHDR':
                width = struct.unpack('>I', chunk_data[0:4])[0]
                height = struct.unpack('>I', chunk_data[4:8])[0]
                bit_depth = chunk_data[8]
                color_type = chunk_data[9]
            elif chunk_type == b'IDAT':
                idat_chunks.append(chunk_data)
            elif chunk_type == b'IEND':
                break

        raw = zlib.decompress(b''.join(idat_chunks))

        # Parse scanlines (only supports RGBA 8-bit and RGB 8-bit)
        bpp = 4 if color_type == 6 else 3  # RGBA or RGB
        stride = width * bpp + 1  # +1 for filter byte
        pixels = []

        prev_row = [0] * (width * bpp)
        offset = 0
        for y in range(height):
            filter_type = raw[offset]
            offset += 1
            row = []
            for x in range(width * bpp):
                val = raw[offset]
                offset += 1

                a = row[x - bpp] if x >= bpp else 0
                b = prev_row[x]
                c = prev_row[x - bpp] if x >= bpp else 0

                if filter_type == 0:  # None
                    pass
                elif filter_type == 1:  # Sub
                    val = (val + a) & 0xFF
                elif filter_type == 2:  # Up
                    val = (val + b) & 0xFF
                elif filter_type == 3:  # Average
                    val = (val + (a + b) // 2) & 0xFF
                elif filter_type == 4:  # Paeth
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    if pa <= pb and pa <= pc:
                        val = (val + a) & 0xFF
                    elif pb <= pc:
                        val = (val + b) & 0xFF
                    else:
                        val = (val + c) & 0xFF

                row.append(val)
            prev_row = row

            # Convert to hex colors
            pixel_row = []
            for px in range(width):
                idx = px * bpp
                r, g, b = row[idx], row[idx + 1], row[idx + 2]
                alpha = row[idx + 3] if bpp == 4 else 255
                if alpha < 128:
                    pixel_row.append('')  # transparent
                else:
                    pixel_row.append(f'#{r:02x}{g:02x}{b:02x}')
            pixels.append(pixel_row)

    return {'width': width, 'height': height, 'pixels': pixels}


def main():
    sprites = {'characters': [], 'floors': [], 'walls': [], 'furniture': {}}

    # Characters
    chars_dir = ASSETS / 'characters'
    if chars_dir.exists():
        for f in sorted(chars_dir.glob('char_*.png')):
            try:
                sprites['characters'].append(decode_png(f))
                print(f'  char: {f.name} ({sprites["characters"][-1]["width"]}x{sprites["characters"][-1]["height"]})')
            except Exception as e:
                print(f'  SKIP: {f.name} ({e})')

    # Floors
    floors_dir = ASSETS / 'floors'
    if floors_dir.exists():
        for f in sorted(floors_dir.glob('floor_*.png')):
            try:
                sprites['floors'].append(decode_png(f))
                print(f'  floor: {f.name}')
            except Exception as e:
                print(f'  SKIP: {f.name} ({e})')

    # Walls
    walls_dir = ASSETS / 'walls'
    if walls_dir.exists():
        for f in sorted(walls_dir.glob('*.png')):
            try:
                sprites['walls'].append(decode_png(f))
                print(f'  wall: {f.name}')
            except Exception as e:
                print(f'  SKIP: {f.name} ({e})')

    # Furniture
    furn_dir = ASSETS / 'furniture'
    if furn_dir.exists():
        for d in sorted(furn_dir.iterdir()):
            if not d.is_dir():
                continue
            sprites['furniture'][d.name] = {}
            for f in sorted(d.glob('*.png')):
                try:
                    sprites['furniture'][d.name][f.stem] = decode_png(f)
                    print(f'  furniture/{d.name}: {f.name}')
                except Exception as e:
                    print(f'  SKIP: {f.name} ({e})')

    # Write output
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(sprites, f, separators=(',', ':'))

    size_kb = OUTPUT.stat().st_size / 1024
    print(f'\nOutput: {OUTPUT} ({size_kb:.0f} KB)')
    print(f'Characters: {len(sprites["characters"])}, Floors: {len(sprites["floors"])}, '
          f'Walls: {len(sprites["walls"])}, Furniture: {len(sprites["furniture"])} categories')


if __name__ == '__main__':
    main()
