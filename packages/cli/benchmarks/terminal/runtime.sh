#!/bin/sh
# usage: runtime.sh <folder> <cli copy>; what every task container mounts at /opt/qvac, from this
# machine, so the agent runs on any image's glibc and the image's own programs keep their libraries
set -e
A=$1 C=$2
CLI=$(cd "$(dirname "$0")/../.." && pwd)
G=/lib/x86_64-linux-gnu
mkdir -p "$A/bin" "$A/lib" "$A/cuda"

# lib: this machine's loader, C library and libstdc++, reached only through the patched binaries
for l in ld-linux-x86-64.so.2 libc.so.6 libm.so.6 libdl.so.2 libpthread.so.0 librt.so.1 \
  libresolv.so.2 libnss_files.so.2 libnss_dns.so.2 libutil.so.1 libanl.so.1 libstdc++.so.6 \
  libgcc_s.so.1 libselinux.so.1 libcap.so.2 libpcre2-8.so.0; do
  cp -L "$G/$l" "$A/lib/"
done

# cuda: the driver's and CUDA 13's libraries, which an old glibc loads too, on the agent's path
for l in libcuda.so.1 libnvidia-ml.so.1 libnvidia-ptxjitcompiler.so.1; do cp -L "$G/$l" "$A/cuda/"; done
for l in libcudart.so.13 libcublas.so.13 libcublasLt.so.13; do
  cp -L "$(ldconfig -p | awk -v l="$l" '$1 == l { print $NF; exit }')" "$A/cuda/"
done

# Node needs only glibc 2.28, so it runs as it is; patchelf breaks it
cp -L "$(command -v node)" "$A/bin/node"
cp -L "$(command -v bwrap)" "$A/bin/bwrap.real"
cat > "$A/bin/bwrap" <<'SH'
#!/bin/sh
# Rootless containers cannot mount a fresh /proc, so bind the container's own where bwrap would mount one.
# bwrap carries its own loader and libraries; the lines it runs get the image's own.
for a do shift; if [ "$a" = "--proc" ]; then set -- "$@" --ro-bind /proc; else set -- "$@" "$a"; fi; done
exec /opt/qvac/bin/bwrap.real --unsetenv LD_LIBRARY_PATH --unsetenv LD_PRELOAD "$@"
SH
chmod +x "$A/bin/bwrap"

# the CLI, hard links but for its Bare binaries, which load the mounted C library instead
cp -al "$CLI" "$C"
patch() {
  cp --remove-destination "$1" "$1.tmp" && mv "$1.tmp" "$1"
  patchelf --set-interpreter /opt/qvac/lib/ld-linux-x86-64.so.2 --force-rpath --set-rpath /opt/qvac/lib "$1"
}
patch "$A/bin/bwrap.real"
find "$C/node_modules" -path '*linux-x64*' -name bare -type f | while read -r b; do
  head -c 4 "$b" | grep -q ELF || continue
  patch "$b"
  # a sidecar's addons look for libstdc++ on their own path, so it loads first
  patchelf --print-needed "$b" | grep -q '^libstdc++' || patchelf --add-needed libstdc++.so.6 "$b"
done
