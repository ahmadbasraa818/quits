"""Draws the Quits icon set: two ink bars, an equals sign for "we're quits", on violet.

Run with Pillow installed: python scripts/draw-icons.py
"""

from PIL import Image, ImageDraw

VIOLET = (139, 108, 255, 255)
INK = (22, 23, 26, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)
OUT = "assets/images/"
WEB = "public/icons/"


def bars(size, colour, scale, background=CLEAR, corner=0.0):
    """The two bars, `scale` of the canvas wide, centred. Drawn at 4x, then reduced, for smooth edges."""
    big = size * 4
    image = Image.new("RGBA", (big, big), CLEAR)
    draw = ImageDraw.Draw(image)
    if background != CLEAR:
        draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * corner), fill=background)
    width = big * scale
    height = width * 0.17
    gap = width * 0.17
    left = (big - width) / 2
    top = (big - (2 * height + gap)) / 2
    for y in (top, top + height + gap):
        draw.rounded_rectangle([left, y, left + width, y + height], radius=height / 2, fill=colour)
    return image.resize((size, size), Image.LANCZOS)


bars(1024, INK, 0.52, VIOLET).save(OUT + "icon.png")
bars(1024, INK, 0.36).save(OUT + "android-icon-foreground.png")
bars(1024, WHITE, 0.36).save(OUT + "android-icon-monochrome.png")
bars(512, INK, 0.8).save(OUT + "splash-icon.png")
bars(96, INK, 0.56, VIOLET, corner=0.22).save(OUT + "favicon.png")
bars(512, INK, 0.52, VIOLET, corner=0.22).save(OUT + "logo.png")
# The web app's icons, for the manifest and the home screen.
bars(512, INK, 0.52, VIOLET).save(WEB + "icon-512.png")
bars(192, INK, 0.52, VIOLET).save(WEB + "icon-192.png")
bars(180, INK, 0.52, VIOLET).save(WEB + "apple-touch-icon.png")
print("drew the icons")
