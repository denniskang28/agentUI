"""Create unmasked visual comparisons; differences are not fidelity scores.

Run after capture-library-experience.ts with a Python installation containing Pillow.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageChops, ImageEnhance, ImageStat

root = Path('artifacts/library-experience/visual')
output = root / 'review'
output.mkdir(exist_ok=True)
for locale in ['zh-CN', 'en-US']:
    for theme in ['light', 'dark']:
        sheet = Image.new('RGB', (1800, 2150), '#d9dde0')
        draw = ImageDraw.Draw(sheet)
        for row, state in enumerate(['content', 'appearance', 'theme', 'export', 'guide']):
            for col, width in enumerate([1440, 1280, 375]):
                name = f'{state}-{locale}-{width}-{theme}.png'
                image = Image.open(root / name).convert('RGB')
                image.thumbnail((590, 400))
                sheet.paste(image, (col * 600 + (600 - image.width) // 2, row * 430 + 26))
                draw.text((col * 600 + 8, row * 430 + 6), name, fill='black')
        sheet.save(output / f'{locale}-{theme}.png')
measurements = []
for theme in ['light', 'dark']:
    for width in [1440, 1280, 375]:
        name = f'{width}-{theme}'
        reference = Image.open(root / f'reference-{name}.png').convert('RGB')
        actual = Image.open(root / f'content-zh-CN-{name}.png').convert('RGB')
        if reference.size != actual.size:
            raise ValueError(f'Viewport mismatch: {name}')
        difference = ImageChops.difference(reference, actual)
        ImageEnhance.Contrast(difference).enhance(4).save(output / f'diff-{name}.png')
        comparison = Image.new('RGB', (reference.width * 2, reference.height))
        comparison.paste(reference, (0, 0))
        comparison.paste(actual, (reference.width, 0))
        comparison.save(output / f'comparison-{name}.png')
        measurements.append({
            'image': name,
            'meanAbsoluteChannelDifference': ImageStat.Stat(difference).mean,
            'differenceBounds': difference.getbbox(),
            'excludedRegions': [],
            'interpretation': 'Unmasked raw difference for manual review; not a fidelity percentage.'
        })
(output / 'measurements.json').write_text(json.dumps(measurements, indent=2))
print('Created four review sheets and six unmasked reference comparisons.')
