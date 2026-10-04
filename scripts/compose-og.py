"""The link preview image, public/og.png, from the README screenshots: python scripts/compose-og.py (needs Pillow).

Messaging apps show it when someone sends a Quits link, such as a shared group.
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER, INK, MUTED, BRAND, LINE = (245, 243, 238), (22, 23, 26), (94, 97, 104), (255, 90, 31), (205, 199, 188)
FONTS = "node_modules/@expo-google-fonts/archivo"


def font(weight, size):
    return ImageFont.truetype(f"{FONTS}/{weight}/Archivo_{weight}.ttf", size)


canvas = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(canvas)

# The mark and the name, then what it does, at the left.
draw.rounded_rectangle([64, 72, 64 + 56, 72 + 56], radius=14, fill=BRAND)
draw.text((64, 160), "Quits", font=font("800ExtraBold", 118), fill=INK)
tagline = font("500Medium", 38)
for index, line in enumerate(["Split costs with friends.", "Settle up in the", "fewest payments."]):
    draw.text((66, 312 + index * 50), line, font=tagline, fill=INK)
draw.text((66, 520), "Any currency · works offline · no sign-up", font=font("600SemiBold", 26), fill=MUTED)

# Two screens at the right: the trip's plan in front, its spending behind.
def screen(path, height):
    image = Image.open(path).convert("RGB")
    image = image.resize((round(image.width * height / image.height), height), Image.LANCZOS)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.width - 1, image.height - 1], radius=34, fill=255)
    return image, mask


back, back_mask = screen("docs/dark-spending.png", 560)
front, front_mask = screen("docs/light-settle.png", 600)
canvas.paste(back, (W - back.width - 40, 60), back_mask)
outline = Image.new("RGB", (front.width + 4, front.height + 4), LINE)
outline_mask = Image.new("L", outline.size, 0)
ImageDraw.Draw(outline_mask).rounded_rectangle([0, 0, outline.width - 1, outline.height - 1], radius=36, fill=255)
x = W - back.width - 40 - front.width + 120
canvas.paste(outline, (x - 2, 40 - 2), outline_mask)
canvas.paste(front, (x, 40), front_mask)

canvas.save("public/og.png", optimize=True)
print("public/og.png", canvas.size)
