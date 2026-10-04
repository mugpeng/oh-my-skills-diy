#!/usr/bin/env python3
"""Build a manuscript DOCX from Markdown sections and gate the result.

Runs the pandoc command below from the project root (defaults in parentheses):

    pandoc sections/*.md --citeproc --bibliography=references.bib -o manuscript.docx

Then performs light structural checks on the produced package. Exit 0 = candidate
accepted, 1 = do not treat the DOCX as final. Stdlib only; no network.
"""

import argparse
import html
import re
import subprocess
import sys
import zipfile
from pathlib import Path

REQUIRED_PARTS = [
    "[Content_Types].xml",
    "word/document.xml",
    "word/styles.xml",
]
UNRESOLVED_CITE = re.compile(r"\[@[^\]]+\]")


def die(msg, code=1):
    print(f"FAIL {msg}")
    sys.exit(code)


def load_sources(sections_dir):
    files = sorted(sections_dir.glob("*.md"))
    if not files:
        die(f"no Markdown sources found in {sections_dir}/")
    return files


def local_images(sources, root):
    """Collect local image paths referenced by sections.

    Pandoc resolves resource paths against the working directory (the project
    root here), not against each source file, so we do the same.
    """
    images = []
    for src in sources:
        for target in re.findall(r"!\[[^\]]*\]\(([^)\s]+)", src.read_text(encoding="utf-8")):
            if re.match(r"^[a-z]+://", target):
                continue
            path = Path(target)
            path = path if path.is_absolute() else root.resolve() / path
            path = path.resolve()
            if root.resolve() not in path.parents:
                die(f"{src.name}: image escapes project root: {target}")
            if not path.is_file():
                die(f"{src.name}: missing image {target}")
            images.append(str(path.relative_to(root.resolve())))
    return images


def plain_text(xml):
    text = re.sub(r"<[^>]+>", "", xml)
    return html.unescape(text)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default=".", help="project root (default: cwd)")
    ap.add_argument("--sections", default="sections", help="sections dir, globbed in filename order")
    ap.add_argument("--bib", default="references.bib", help="BibTeX file (omit for none)")
    ap.add_argument("--output", default="manuscript.docx", help="output DOCX path")
    ap.add_argument("--reference-doc", default=None, help="pandoc --reference-doc path")
    ap.add_argument("--no-build", action="store_true", help="only check an existing DOCX")
    args = ap.parse_args()

    root = Path(args.project)
    sections_dir = Path(args.sections) if Path(args.sections).is_absolute() else root / args.sections
    output = Path(args.output) if Path(args.output).is_absolute() else root / args.output
    bib = Path(args.bib) if Path(args.bib).is_absolute() else root / args.bib

    sources = load_sources(sections_dir)
    body = "".join(src.read_text(encoding="utf-8") for src in sources)
    results = []

    if not args.no_build:
        cmd = ["pandoc", *[str(s) for s in sources], "-o", str(output)]
        if bib.is_file():
            cmd += ["--citeproc", f"--bibliography={bib}"]
        if args.reference_doc:
            cmd += [f"--reference-doc={args.reference_doc}"]
        print("+ " + " ".join(cmd))
        proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
        if proc.stderr.strip():
            print(proc.stderr.strip())
        if proc.returncode != 0:
            die(f"pandoc exited {proc.returncode}", 1)
        results.append(("pandoc build", True, f"exit 0, {output.stat().st_size} bytes"))

    if not output.is_file():
        die(f"missing output {output}", 1)

    with zipfile.ZipFile(output) as zf:
        names = zf.namelist()
        missing = [p for p in REQUIRED_PARTS if p not in names]
        if missing:
            die(f"DOCX missing required parts: {missing}", 1)
        results.append(("OOXML package", True, f"required parts present, {len(names)} members"))
        bad = zf.testzip()
        if bad is not None:
            die(f"corrupt zip member: {bad}", 1)
        results.append(("zip integrity", True, "CRC ok"))
        document_xml = zf.read("word/document.xml").decode("utf-8")
        media = [n for n in names if n.startswith("word/media/")]

    doc_text = plain_text(document_xml)

    if UNRESOLVED_CITE.search(doc_text):
        hits = UNRESOLVED_CITE.findall(doc_text)[:3]
        die(f"unresolved citations in output: {hits}", 1)
    results.append(("citations resolved", True, "no leftover [@key]"))

    expected = local_images(sources, root)
    embedded = len(media)
    if embedded < len(expected):
        die(f"docx embeds {embedded} media files but sources reference {len(expected)}", 1)
    results.append(("figures embedded", True, f"{embedded} media >= {len(expected)} referenced"))

    cited = sorted(set(re.findall(r"\[@([^,\] ]+)", body)))
    if cited:
        if not bib.is_file():
            die(f"sources cite {cited[:3]} but no {bib} found", 1)
        entries = dict(re.findall(r"@\w+\{\s*([^,\s]+)\s*,(.*?)(?=\n@|\Z)", bib.read_text(encoding="utf-8"), re.S))
        for key in cited:
            fields = entries.get(key)
            if fields is None:
                die(f"cited key missing from {bib.name}: {key}", 1)
                continue
            author = re.search(r"author\s*=\s*[\"{]([^,}{\"]+)", fields)
            if author and author.group(1).strip() not in doc_text:
                die(f"bibliography entry not rendered for {key} ({author.group(1).strip()})", 1)
        results.append(("bibliography", True, f"{len(cited)} cited keys all rendered"))

    headings = [h for src in sources for h in re.findall(r"^#\s+(.+)$", src.read_text(encoding="utf-8"), re.M)]
    missing_headings = [h.strip() for h in headings if html.escape(h.strip()) not in document_xml]
    if missing_headings:
        die(f"headings missing from output: {missing_headings}", 1)
    results.append(("headings", True, f"all {len(headings)} H1 present in order of files"))

    width, fail = 34, 0
    for name, ok, detail in results:
        if not ok:
            fail += 1
        print(f"{'PASS' if ok else 'FAIL'} {name:<{width}} {detail}")
    print(f"{'PASS' if fail == 0 else 'FAIL'} {len(results)} checks, {fail} failures -> {output}")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
