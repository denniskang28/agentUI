"""Build review indexes without masking or changing the source screenshots."""
from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw

root = Path('artifacts/visual')
destination = root / 'review-sheets'
destination.mkdir(exist_ok=True)
for locale in ['zh-CN', 'en-US']:
    for theme in ['light', 'dark']:
        sheet = Image.new('RGB', (1800, 1720), '#d9dde0')
        draw = ImageDraw.Draw(sheet)
        for row, page in enumerate(['playground', 'plugins', 'docs', 'benchmarks']):
            for col, width in enumerate([1440, 1280, 375]):
                name = f'{page}-{locale}-{width}-{theme}.png'
                image = Image.open(root / 'layout-matrix' / name).convert('RGB')
                image.thumbnail((590, 400))
                sheet.paste(image, (col * 600 + (600 - image.width) // 2, row * 430 + 26))
                draw.text((col * 600 + 8, row * 430 + 6), name, fill='black')
                if locale == 'zh-CN':
                    copyfile(root / 'layout-matrix' / name, root / 'implementation' / f'{page}-{width}-{theme}.png')
        sheet.save(destination / f'pages-{locale}-{theme}.png')
        sheet = Image.new('RGB', (750, 2508), '#d9dde0')
        draw = ImageDraw.Draw(sheet)
        for index, state in enumerate(['copy', 'mode-switch', 'syntax-error', 'uninstall', 'waiting', 'approval-complete']):
            col, row = index % 2, index // 2
            image = Image.open(root / 'ui-states' / f'{state}-{locale}-375-{theme}.png').convert('RGB')
            sheet.paste(image, (col * 375, row * 836 + 24))
            draw.text((col * 375 + 4, row * 836 + 4), state, fill='black')
        sheet.save(destination / f'states-{locale}-375-{theme}.png')
print('Created 8 review indexes and copied 24 matching Chinese implementation screenshots.')
