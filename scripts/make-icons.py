"""Draw the app icons from the "m." wordmark: charcoal field, off-white tile, serif "m.". Run: python scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BG, INK = (26, 25, 27), (246, 245, 241)
OUT = Path(__file__).resolve().parent.parent / "icons"
FONT = next((p for p in ["C:/Windows/Fonts/georgiab.ttf", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"] if Path(p).exists()), None)


def icon(size, tile_ratio):
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    tile = round(size * tile_ratio)
    x0 = (size - tile) // 2
    draw.rectangle([x0, x0, x0 + tile, x0 + tile], fill=INK)
    font = ImageFont.load_default()
    if FONT:  # largest size whose glyphs fill 78% of the tile width
        size_pt = tile
        while size_pt > 4:
            font = ImageFont.truetype(FONT, size_pt)
            box = draw.textbbox((0, 0), "m.", font=font)
            if box[2] - box[0] <= tile * 0.78:
                break
            size_pt -= 1
    box = draw.textbbox((0, 0), "m.", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((x0 + (tile - w) / 2 - box[0], x0 + (tile - h) / 2 - box[1]), "m.", font=font, fill=BG)
    return img


OUT.mkdir(exist_ok=True)
icon(512, 0.62).save(OUT / "icon-512.png")
icon(192, 0.62).save(OUT / "icon-192.png")
icon(512, 0.5).save(OUT / "icon-maskable-512.png")  # content inside the 80% maskable safe zone
icon(180, 0.62).save(OUT / "apple-touch-icon.png")
icon(32, 0.86).save(OUT / "favicon-32.png")
print("icons written to", OUT)
