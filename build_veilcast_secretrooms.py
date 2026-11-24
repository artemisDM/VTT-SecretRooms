#!/usr/bin/env python3
"""Make a minimally changed VeilCast copy with the Secret Room Toggle.

Builder v1.1: resilient single-point patch for campaign backup restoration.

Run: python build_veilcast_secretrooms.py [--zip VeilCast-VTT-main.zip]
Or:  python build_veilcast_secretrooms.py --source path/to/VeilCast-VTT

No third-party Python packages required.
"""
from __future__ import annotations
import argparse
import io
import re
from pathlib import Path
import shutil
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
OUT = HERE / "VeilCast_SecretRooms"
GITHUB_ZIP = "https://codeload.github.com/cr-lolo/VeilCast-VTT/zip/refs/heads/main"


def replace_one(text: str, old: str, new: str, what: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Refusing to change {what}: expected one exact anchor, found {count}. "
                         "Upstream VeilCast may have changed; no patched app was produced.")
    return text.replace(old, new, 1)


def patch_backup_import(text: str) -> str:
    """Preserve secret artwork in restored scene metadata; fail closed if ambiguous.

    The older anchor required two adjacent lines, with seven leading spaces. It
    rejected otherwise equivalent official builds when either line was reindented
    or the importer gained an extra assignment. We anchor to the unique *save*
    of a newly imported `nueva` scene instead, verifying the surrounding code
    is actually reading `sd` (the import's source scene object).
    """
    pattern = re.compile(r"(?m)^([ \t]*)await[ \t]+guardarEscenaMeta[ \t]*\([ \t]*nueva[ \t]*\)[ \t]*;[ \t]*$")
    matches = list(pattern.finditer(text))
    # There may be other handlers saving newly created scenes; do not alter them.
    candidates = []
    for match in matches:
        previous = text[max(0, match.start()-1800):match.start()]
        # VeilCast's backup importer uses sd (source scene data) and nueva
        # (restored scene). Both are required for the new optional field.
        if re.search(r"\bsd\s*\.", previous) and re.search(r"\bnueva\s*\.", previous):
            candidates.append(match)
    if len(candidates) != 1:
        raise ValueError(
            'Refusing to modify backup-import restoration: expected one uniquely '
            f'identifiable imported-scene save; found {len(candidates)} '
            f'(total guardarEscenaMeta(nueva) saves: {len(matches)}). '
            'No modified app was produced. Please report the failure.'
        )
    m = candidates[0]
    prefix = m.group(1)
    addition = prefix + 'if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;\n'
    return text[:m.start()] + addition + text[m.start():]


def patch(text: str, addon: str) -> str:
    if "BEGIN VeilCast Secret Room Toggle" in text:
        raise ValueError("This copy is already modified. Start from an original unmodified VeilCast index.html.")
    # Add one self-contained feature block inside the original app's JavaScript closure.
    text = replace_one(text,
        "/* ============ render ============ */",
        addon + "\n/* ============ render ============ */",
        "inject isolated secret-room functions")
    # This specific position guarantees the secret artwork is drawn BEFORE existing fog,
    # and after the normal base-map art. No fog/vision algorithm is changed.
    text = replace_one(text,
        "  c.drawImage(s.img,0,0);\n  c.globalAlpha=1;",
        "  c.drawImage(s.img,0,0);\n  secretRoomsDraw(c,s);\n  c.globalAlpha=1;",
        "draw secret artwork beneath fog")
    # The original metadata saver is left as-is, except for one extra optional field.
    text = replace_one(text,
        "lights:s.lights||[], ambiente:s.ambiente||null, updated:Date.now()",
        "lights:s.lights||[], ambiente:s.ambiente||null, secretRooms:s.secretRooms||[], updated:Date.now()",
        "persist secret room overlays with their scene")
    # Copy overlays on duplicate map, just like normal walls are copied.
    text = replace_one(text,
        "fogModo:o.fogModo||'manual', img:null, ready:false",
        "fogModo:o.fogModo||'manual', secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), img:null, ready:false",
        "copy secret rooms when duplicating a scene")
    # Preserve overlays inside the existing standard campaign backup format.
    text = replace_one(text,
        "      walls:s.walls||[], tokens:s.tokens||{}, fogModo:s.fogModo||'manual',\n      img:",
        "      walls:s.walls||[], tokens:s.tokens||{}, fogModo:s.fogModo||'manual',\n"
        "      secretRooms:s.secretRooms||[],\n      img:",
        "include overlays when exporting campaign backup")
    # The exact whitespace around the backup importer changes across VeilCast revisions.
    # Insert one optional property assignment immediately before saving the *newly
    # imported* scene.  Never monkey-patch the unrelated map/fog saving functions.
    text = patch_backup_import(text)
    # Add DM-only floating panel, after VeilCast starts its existing app init.
    text = replace_one(text,
        "arrancar();\n})();",
        "arrancar();\ninitSecretRooms();\n})();",
        "initialize DM-only Secret Rooms panel")
    return text


def download_zip() -> bytes:
    print("Downloading unmodified official VeilCast source from GitHub...")
    req = urllib.request.Request(GITHUB_ZIP, headers={"User-Agent": "VeilCast-SecretRoom-Builder/1.0"})
    with urllib.request.urlopen(req, timeout=50) as result:
        data = result.read(30_000_000)
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ValueError("Official VeilCast download was not a ZIP archive.")
    return data


def unzip_source(data: bytes, target: Path) -> None:
    # Safely extract only paths under the GitHub archive's top-level directory.
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [i.filename for i in z.infolist() if not i.is_dir()]
        roots = set(n.split("/", 1)[0] for n in names)
        if len(roots) != 1:
            raise ValueError("Unexpected VeilCast ZIP structure")
        root = roots.pop()
        for member in z.infolist():
            if member.is_dir():
                continue
            name = member.filename
            if not name.startswith(root + "/"):
                raise ValueError("Unexpected file path in ZIP")
            relative = Path(name[len(root) + 1:])
            if not relative.parts or ".." in relative.parts or relative.is_absolute():
                raise ValueError("Unsafe file path in ZIP")
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(member))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--zip", type=Path, help="Use your already-downloaded official VeilCast source ZIP")
    p.add_argument("--source", type=Path, help="Use a local copy of the unmodified VeilCast source folder")
    args = p.parse_args()
    if args.zip and args.source:
        p.error("Choose --zip or --source, not both")
    if OUT.exists():
        raise ValueError(f"{OUT} already exists. Rename it first to protect your previous build.")
    staging = HERE / "_secretrooms_build_staging"
    if staging.exists():
        raise ValueError(f"A build staging folder already exists: {staging}")
    try:
        staging.mkdir()
        if args.source:
            source = args.source.expanduser().resolve()
            if not (source / "index.html").is_file():
                raise ValueError(f"No index.html in {source}")
            shutil.copytree(source, staging, dirs_exist_ok=True)
        elif args.zip:
            unzip_source(args.zip.read_bytes(), staging)
        else:
            unzip_source(download_zip(), staging)
        index = staging / "index.html"
        if not index.is_file():
            raise ValueError("Could not find index.html in the official VeilCast source")
        original = index.read_text(encoding="utf-8")
        addon = (HERE / "secret_rooms_feature.js").read_text(encoding="utf-8")
        modified = patch(original, addon)
        index.write_text(modified, encoding="utf-8")
        shutil.copy2(HERE / "start_veilcast.py", staging / "start_veilcast.py")
        (staging / "START_WINDOWS.bat").write_text(
            '@echo off\r\ncd /d "%~dp0"\r\npy -3 start_veilcast.py\r\nif errorlevel 1 pause\r\n', encoding="utf-8")
        (staging / "START_MAC_LINUX.sh").write_text(
            '#!/bin/sh\ncd "$(dirname "$0")"\npython3 start_veilcast.py\n', encoding="utf-8")
        (staging / "START_MAC_LINUX.sh").chmod(0o755)
        staging.rename(OUT)
        print("\nSUCCESS: VeilCast Secret Rooms built in:")
        print(OUT)
        print("Only index.html was patched. All other upstream files are copied unchanged.")
        print("\nStart it with START_WINDOWS.bat or python3 start_veilcast.py")
        print("Then open http://localhost:8765/")
        print("Remember: export your current campaign backup and import it here once.")
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("\nBUILD NOT APPLIED:", err)
        raise SystemExit(1)
