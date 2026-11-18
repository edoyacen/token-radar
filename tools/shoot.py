# -*- coding: utf-8 -*-
"""Render the token-radar dashboard and cut the three screenshots the entry hands in.

One tall capture of the page at 1440 wide, then three 1440x900 windows cut from it: the evidence and the
board, one row's detail, and a filtered view at a larger deposit. Cropping a single render is steadier
than scrolling three times, and each cut is checked against the gate's pixel limits and byte cap.
"""
import io
import os
import shutil
import subprocess

CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
WORK = os.path.join(HERE, "shotwork")
SHOTS = os.path.join(HERE, "screenshots")
TALL = 3000

# (name, hash route, top of the 1440x900 window in the tall capture)
PLAN = [
    ("1-board.png", "", 0),
    ("2-detail.png", "#detail=steakhouse-financial&dep=1500", 1420),
    ("3-filtered.png", "#v=FARM&dep=500", 1420),
]


def render(route, name):
    """Capture the page at 1440xTALL with a hash route applied after load."""
    index = os.path.join(WORK, "dashboard", "index.html")
    html = io.open(os.path.join(OUT, "dashboard", "index.html"), encoding="utf-8").read()
    if route:
        inject = ("<script>window.addEventListener('load',function(){location.hash='%s';});</script>" % route)
        html = html.replace("</body>", inject + "</body>")
    io.open(index, "w", encoding="utf-8").write(html)
    target = os.path.join(WORK, name)
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--virtual-time-budget=4000", "--window-size=1440,%d" % TALL,
         "--screenshot=" + target.replace("/", "\\"),
         "file:///" + index.replace("\\", "/")],
        check=True, capture_output=True,
    )
    return target


def prepare():
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    os.makedirs(SHOTS, exist_ok=True)
    shutil.copyfile(os.path.join(OUT, "data.js"), os.path.join(WORK, "data.js"))
    shutil.copytree(os.path.join(OUT, "dashboard"), os.path.join(WORK, "dashboard"))


def main():
    from PIL import Image
    prepare()
    cache = {}
    for name, route, top in PLAN:
        if route not in cache:
            cache[route] = render(route, "tall%d.png" % len(cache))
        im = Image.open(cache[route]).convert("RGB")
        w, h = im.size
        box = (0, min(top, max(0, h - 900)), w, min(top, max(0, h - 900)) + 900)
        crop = im.crop(box)
        path = os.path.join(SHOTS, name)
        crop.save(path, optimize=True, compress_level=9)
        size = os.path.getsize(path)
        long_side, short_side = max(crop.size), min(crop.size)
        ok = long_side <= 1440 and short_side >= 800 and size <= 512 * 1024
        print("%-14s %s %7d bytes  top=%d  %s" % (name, "%dx%d" % crop.size, size, box[1],
                                                  "gate ok" if ok else "GATE FAIL"))


if __name__ == "__main__":
    main()
