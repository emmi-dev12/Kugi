#!/usr/bin/env python3
"""Generate Kugi.icns from scratch using only stdlib."""
import struct, zlib, os, subprocess

def make_png(size):
    """Generate a PNG of the Kugi icon at given size."""
    s = size
    img = []
    # background color: #080808
    bg = (8, 8, 8, 255)
    # 4 quads: TL=blue, TR=purple, BL=green, BR=red
    colors = {
        'tl': (79, 124, 255, 255),
        'tr': (139, 92, 246, 255),
        'bl': (16, 185, 129, 255),
        'br': (244, 63, 94, 255),
    }

    pad = max(2, s // 16)
    gap = max(1, s // 32)
    corner = max(2, s // 12)

    half = (s - pad * 2 - gap) // 2
    # quad positions: (x, y, w, h)
    quads = [
        (pad, pad, half, half, colors['tl']),
        (pad + half + gap, pad, half, half, colors['tr']),
        (pad, pad + half + gap, half, half, colors['bl']),
        (pad + half + gap, pad + half + gap, half, half, colors['br']),
    ]

    # Build pixel grid
    pixels = [[bg] * s for _ in range(s)]

    def in_rounded_rect(px, py, rx, ry, rw, rh, r):
        if px < rx or px >= rx + rw or py < ry or py >= ry + rh:
            return False
        # corner check
        corners = [(rx + r, ry + r), (rx + rw - r, ry + r),
                   (rx + r, ry + rh - r), (rx + rw - r, ry + rh - r)]
        if px < rx + r and py < ry + r:
            cx, cy = corners[0]
            return (px - cx)**2 + (py - cy)**2 <= r**2
        if px >= rx + rw - r and py < ry + r:
            cx, cy = corners[1]
            return (px - cx)**2 + (py - cy)**2 <= r**2
        if px < rx + r and py >= ry + rh - r:
            cx, cy = corners[2]
            return (px - cx)**2 + (py - cy)**2 <= r**2
        if px >= rx + rw - r and py >= ry + rh - r:
            cx, cy = corners[3]
            return (px - cx)**2 + (py - cy)**2 <= r**2
        return True

    # Outer rounded rect for the app icon shape
    outer_r = max(4, s // 6)
    for y in range(s):
        for x in range(s):
            if not in_rounded_rect(x, y, 0, 0, s, s, outer_r):
                pixels[y][x] = (0, 0, 0, 0)  # transparent outside
                continue
            for qx, qy, qw, qh, col in quads:
                if in_rounded_rect(x, y, qx, qy, qw, qh, corner):
                    pixels[y][x] = col
                    break

    # Encode PNG
    def pack_chunk(tag, data):
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', c)

    raw = b''
    for row in pixels:
        raw += b'\x00'
        for r2, g, b2, a in row:
            raw += bytes([r2, g, b2, a])

    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack('>IIBBBBB', s, s, 8, 6, 0, 0, 0)
    png = (
        b'\x89PNG\r\n\x1a\n'
        + pack_chunk(b'IHDR', ihdr)
        + pack_chunk(b'IDAT', compressed)
        + pack_chunk(b'IEND', b'')
    )
    return png


iconset = '/Users/mh/Desktop/Kugi/app/assets/icons.iconset'
os.makedirs(iconset, exist_ok=True)

sizes = [16, 32, 64, 128, 256, 512, 1024]
for sz in sizes:
    data = make_png(sz)
    name = f'icon_{sz}x{sz}.png'
    path = os.path.join(iconset, name)
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  wrote {name}')
    # @2x version (same image, different name)
    if sz <= 512:
        name2x = f'icon_{sz}x{sz}@2x.png'
        with open(os.path.join(iconset, name2x), 'wb') as f:
            f.write(data)
        print(f'  wrote {name2x}')

print('Running iconutil...')
result = subprocess.run(
    ['iconutil', '-c', 'icns', iconset, '-o', '/Users/mh/Desktop/Kugi/app/assets/icon.icns'],
    capture_output=True, text=True
)
if result.returncode == 0:
    print('icon.icns created OK')
else:
    print('iconutil error:', result.stderr)
