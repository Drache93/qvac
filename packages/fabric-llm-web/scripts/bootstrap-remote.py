"""Prepare an isolated Emscripten toolchain and browser test tools on a build host."""
import json
import pathlib
import subprocess
import tarfile
import urllib.request

root = pathlib.Path.home() / "qvac-26838-tools"
root.mkdir(exist_ok=True)
sdk = root / "emsdk"
if not sdk.exists():
    archive = root / "emsdk.tar.gz"
    urllib.request.urlretrieve("https://github.com/emscripten-core/emsdk/archive/refs/tags/4.0.23.tar.gz", archive)
    with tarfile.open(archive) as tar:
        tar.extractall(root, filter="data")
    (root / "emsdk-4.0.23").rename(sdk)
subprocess.run([str(sdk / "emsdk"), "install", "4.0.23"], check=True)
subprocess.run([str(sdk / "emsdk"), "activate", "4.0.23"], check=True)
tools = root / "browser"
tools.mkdir(exist_ok=True)
(tools / "package.json").write_text(json.dumps({"private": True, "type": "module"}))
node_bin = pathlib.Path.home() / "node24/bin"
import os
env = dict(os.environ, PATH=f"{node_bin}:{os.environ['PATH']}")
subprocess.run([str(node_bin / "npm"), "install", "--prefix", str(tools), "--ignore-scripts", "esbuild@0.25.12", "playwright@1.64.1"], env=env, check=True)
subprocess.run([str(node_bin / "node"), str(tools / "node_modules/playwright/cli.js"), "install", "chromium"], env=env, check=True)
