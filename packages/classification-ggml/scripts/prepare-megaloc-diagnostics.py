"""Prepare pinned public images and original PyTorch references for diagnosis."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tarfile
import time
import urllib.request

GARDENS = 'https://huggingface.co/datasets/medwa126/GardensPointWalking/resolve/676786aa5abbf6f2016507000280712abc46ed16/'
HOTELS = 'https://huggingface.co/datasets/imagingforgood/OpenHotelsSample/resolve/7b19b79705c22c371c665aee1d90c7529ab80ef7/'
MODEL = 'https://huggingface.co/gberton/MegaLoc/resolve/a0f34722c4297ff787e022433799250180860af7/model.safetensors'
CODE = 'https://raw.githubusercontent.com/gmberton/MegaLoc/5fe0dd697c4a70ba3e23607f6716ab3c606b16db/megaloc_model.py'
CHECKPOINT_HASH = 'd4f9f2bcb60018f91eb6a8e061ed054fd55654e10c2569cf13841ea986ffb4f8'


def download(url, destination):
    if destination.exists():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as source, destination.with_suffix('.partial').open('wb') as out:
                shutil.copyfileobj(source, out)
            destination.with_suffix('.partial').replace(destination)
            return
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--local-root', type=Path)
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'test/fixtures/megaloc-diagnostic-images.json').read_text())
    records = manifest['records'][:args.limit] if args.limit else manifest['records']
    args.output.mkdir(parents=True, exist_ok=True)
    if args.local_root:
        for row in records:
            shutil.copyfile(args.local_root / 'datasets' / row['dataset'] / row['source'], args.output / row['asset'])
        baseline = args.local_root / 'results/pytorch-cpu-F32.bin'
        with baseline.open('rb') as source, (args.output / 'megaloc-diag-pytorch-f32.bin').open('wb') as out:
            out.write(source.read(len(records) * 8448 * 4))
    else:
        cache = args.output.parent / 'diagnostic-source-cache'
        cache.mkdir(parents=True, exist_ok=True)
        def garden(row):
            download(GARDENS + row['source'], args.output / row['asset'])
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(garden, [r for r in records if r['dataset'] == 'gardens']))
        for split in ['gallery', 'test_non_object', 'test_object']:
            rows = [r for r in records if r['dataset'] == 'hotels' and r['split'] == split]
            if not rows:
                continue
            archive = cache / f'{split}.tar'
            download(HOTELS + f'shards/{split}-00000.tar', archive)
            with tarfile.open(archive) as package:
                members = {m.name.lstrip('./'): m for m in package if m.isfile()}
                for row in rows:
                    matches = [m for name, m in members.items() if name == row['source'] or row['source'].endswith('/' + name)]
                    if len(matches) != 1:
                        raise ValueError(f"Ambiguous hotel archive member: {row['source']}")
                    with package.extractfile(matches[0]) as source, (args.output / row['asset']).open('wb') as out:
                        shutil.copyfileobj(source, out)
        checkpoint = cache / 'model.safetensors'
        code = cache / 'megaloc_model.py'
        download(MODEL, checkpoint)
        download(CODE, code)
        with checkpoint.open('rb') as source:
            assert hashlib.file_digest(source, 'sha256').hexdigest() == CHECKPOINT_HASH
        os.environ['CUDA_VISIBLE_DEVICES'] = ''
        import numpy as np
        from PIL import Image
        import torch
        from torchvision import transforms
        from safetensors.torch import load_file
        torch.set_num_threads(8)
        spec = importlib.util.spec_from_file_location('original_megaloc', code)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        model = module.MegaLoc().eval()
        model.load_state_dict(load_file(checkpoint), strict=True)
        transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize([.485, .456, .406], [.229, .224, .225]),
                                        transforms.Resize([322, 322], antialias=True)])
        with (args.output / 'megaloc-diag-pytorch-f32.bin').open('wb') as out, torch.inference_mode():
            for i, row in enumerate(records):
                x = transform(Image.open(args.output / row['asset']).convert('RGB')).unsqueeze(0)
                descriptor = model(x).numpy().astype('<f4')
                assert descriptor.shape == (1, 8448) and np.isfinite(descriptor).all()
                out.write(descriptor.tobytes())
                if i % 50 == 0:
                    print(f'Original PyTorch FP32 references: {i + 1}/{len(records)}', flush=True)
        manifest['torch_version'] = torch.__version__
    for row in records:
        assert hashlib.sha256((args.output / row['asset']).read_bytes()).hexdigest() == row['sha256'], row['asset']
    manifest['records'] = records
    manifest['checkpoint_sha256'] = CHECKPOINT_HASH
    manifest['reference_sha256'] = hashlib.sha256((args.output / 'megaloc-diag-pytorch-f32.bin').read_bytes()).hexdigest()
    (args.output / 'megaloc-diag-manifest.bin').write_text(json.dumps(manifest))
    print(f'Prepared {len(records)} image/reference pairs; SHA256={manifest["reference_sha256"]}', flush=True)


if __name__ == '__main__':
    main()
