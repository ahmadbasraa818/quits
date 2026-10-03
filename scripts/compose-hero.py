"""Lays three screenshots side by side for the README: python scripts/compose-hero.py (needs Pillow)."""

from PIL import Image, ImageDraw

SHOTS = ["docs/light-groups.png", "docs/light-settle.png", "docs/dark-add.png"]
BACKGROUND = (237, 233, 225)
PAD, GAP, RADIUS = 96, 64, 64

screens = [Image.open(path).convert("RGB") for path in SHOTS]
width = PAD * 2 + sum(s.width for s in screens) + GAP * (len(screens) - 1)
height = PAD * 2 + max(s.height for s in screens)
canvas = Image.new("RGB", (width, height), BACKGROUND)
x = PAD
for screen in screens:
    mask = Image.new("L", screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen.width - 1, screen.height - 1], radius=RADIUS, fill=255)
    outline = Image.new("RGB", (screen.width + 4, screen.height + 4), (205, 199, 188))
    outline_mask = Image.new("L", outline.size, 0)
    ImageDraw.Draw(outline_mask).rounded_rectangle([0, 0, outline.width - 1, outline.height - 1], radius=RADIUS + 2, fill=255)
    canvas.paste(outline, (x - 2, PAD - 2), outline_mask)
    canvas.paste(screen, (x, PAD), mask)
    x += screen.width + GAP
canvas = canvas.resize((width // 2, height // 2), Image.LANCZOS)
canvas.save("docs/hero.png", optimize=True)
print("docs/hero.png", canvas.size)
