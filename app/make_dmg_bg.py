#!/usr/bin/env python3
import struct, zlib

def make_png(w, h, pixels_fn):
    raw = b''
    for y in range(h):
        raw += b'\x00'
        for x in range(w):
            raw += bytes(pixels_fn(x, y))

    def chunk(tag, data):
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', c)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)  # RGB
    compressed = zlib.compress(raw, 6)
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', compressed)
        + chunk(b'IEND', b'')
    )

W, H = 540, 380

def px(x, y):
    # subtle gradient: very dark, slight blue tint top-left
    r = 12 + int((x / W) * 4)
    g = 12 + int((y / H) * 2)
    b = 16 + int((x / W) * 6) + int((y / H) * 4)
    return [min(r, 255), min(g, 255), min(b, 255)]

data = make_png(W, H, px)
with open('/Users/mh/Desktop/Kugi/app/assets/dmg-bg.png', 'wb') as f:
    f.write(data)
print('dmg-bg.png written')
