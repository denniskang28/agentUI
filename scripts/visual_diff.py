"""Generate review artifacts; pixel differences are not a UI fidelity score.

Requires Pillow. Run after pnpm visual:reference and pnpm visual:capture.
"""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageEnhance, ImageStat

root = Path('artifacts/visual')
destination = root / 'diff'
destination.mkdir(parents=True, exist_ok=True)
results = []
for baseline in sorted((root / 'reference').glob('*.png')):
    implementation = root / 'implementation' / baseline.name
    if not implementation.exists():
        continue
    reference = Image.open(baseline).convert('RGB')
    actual = Image.open(implementation).convert('RGB')
    if reference.size != actual.size:
        raise ValueError(f'Viewport mismatch: {baseline.name}')
    difference = ImageChops.difference(reference, actual)
    ImageEnhance.Contrast(difference).enhance(4).save(destination / baseline.name)
    comparison = Image.new('RGB', (reference.width * 2, reference.height))
    comparison.paste(reference, (0, 0))
    comparison.paste(actual, (reference.width, 0))
    comparison.save(destination / f'comparison-{baseline.name}')
    results.append({'image': baseline.name,
                    'meanAbsoluteChannelDifference': ImageStat.Stat(difference).mean,
                    'differenceBounds': difference.getbbox(),
                    'excludedRegions': [],
                    'interpretation': 'Unmasked raw difference for manual review; not a fidelity percentage.'})
(destination / 'measurements.json').write_text(json.dumps(results, indent=2))
print(f'Wrote {len(results)} unmasked comparisons to {destination}')
