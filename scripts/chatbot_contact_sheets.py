"""Index genuine chatbot screenshots without changing the originals."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('artifacts/chatbot-visual')
entries = json.loads((root / 'matrix.json').read_text())['entries']
out = root / 'review-sheets'
out.mkdir(exist_ok=True)
for variant in ['baseline', 'with-agent-ui']:
    for locale in ['zh-CN', 'en-US']:
        for theme in ['light', 'dark']:
            selected = [e for e in entries if e['variant'] == variant and e['locale'] == locale and e['theme'] == theme]
            canvas = Image.new('RGB', (1500, 1200), '#e5e7eb')
            draw = ImageDraw.Draw(canvas)
            for i, entry in enumerate(selected):
                image = Image.open(entry['screenshot']).convert('RGB')
                image.thumbnail((480, 540))
                x, y = (i // 2) * 500 + 10, (i % 2) * 600 + 36
                canvas.paste(image, (x, y))
                draw.text((x, y - 23), f"{variant} {locale} {theme} {entry['viewport']} {entry['state']}", fill='#111827')
            canvas.save(out / f'{variant}-{locale}-{theme}.jpg', quality=90)
print(f'Created 8 review sheets from {len(entries)} screenshots')
