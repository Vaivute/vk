#!/usr/bin/env python3
"""Build an AI/ATS-readable PDF resume from resume.md.

Produces Vaiva_Kalnikaite_Resume.pdf (and an intermediate resume.html)
with a single-column layout, real embedded text, and standard heading
hierarchy so applicant tracking systems and LLM screeners can reliably
extract every section.

Usage:
    python3 build-resume-pdf.py
"""
import html as html_mod
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "resume.md"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Role-specific variants. Each entry overrides the subtitle line in the source
# markdown and writes a differently-named PDF. Add more as needed.
BASE_SUBTITLE = "PhD · FRSA | Head of UX"
VARIANTS = [
    {
        "suffix": "",
        "subtitle": None,  # use BASE_SUBTITLE as-is
    },
    {
        "suffix": "_DES",
        "subtitle": "PhD · FRSA | Transformation & Innovation Leader · Head of UX, GenAI",
    },
]


def inline(text: str) -> str:
    text = html_mod.escape(text, quote=False)
    text = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>',
        text,
    )
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*", r"<em>\1</em>", text)
    return text


def md_to_html(md: str) -> str:
    lines = md.splitlines()
    n = len(lines)
    out: list[str] = []
    i = 0

    out.append('<header class="r-header">')
    while i < n:
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        if s == "---":
            i += 1
            break
        if s.startswith("# "):
            out.append(f"<h1>{inline(s[2:])}</h1>")
        else:
            out.append(f'<p class="r-meta">{inline(s)}</p>')
        i += 1
    out.append("</header>")

    out.append("<main>")
    in_section = False
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def close_section() -> None:
        nonlocal in_section
        if in_section:
            out.append("</section>")
            in_section = False

    while i < n:
        s = lines[i].strip()

        if not s:
            close_list()
            i += 1
            continue
        if s == "---":
            close_list()
            close_section()
            i += 1
            continue
        if s.startswith("## "):
            close_list()
            close_section()
            title = s[3:].strip()
            anchor = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            out.append(f'<section id="{anchor}">')
            out.append(f"<h2>{inline(title)}</h2>")
            in_section = True
            i += 1
            continue
        if s.startswith("### "):
            close_list()
            out.append('<div class="r-entry">')
            out.append(f"<h3>{inline(s[4:].strip())}</h3>")
            i += 1
            j = i
            while j < n and not lines[j].strip():
                j += 1
            if j < n:
                meta = lines[j].strip()
                if (
                    meta
                    and not meta.startswith("#")
                    and meta != "---"
                    and not meta.startswith("- ")
                ):
                    out.append(f'<div class="r-entry-meta">{inline(meta)}</div>')
                    i = j + 1
            paras: list[str] = []
            current: list[str] = []
            while i < n:
                bs = lines[i].strip()
                if bs.startswith("#") or bs == "---" or bs.startswith("- "):
                    break
                if not bs:
                    k = i + 1
                    while k < n and not lines[k].strip():
                        k += 1
                    if k >= n:
                        break
                    nxt = lines[k].strip()
                    if nxt.startswith("#") or nxt == "---" or nxt.startswith("- "):
                        break
                    if current:
                        paras.append(" ".join(current))
                        current = []
                    i = k
                    continue
                current.append(bs)
                i += 1
            if current:
                paras.append(" ".join(current))
            for p in paras:
                out.append(f"<p>{inline(p)}</p>")
            out.append("</div>")
            continue
        if s.startswith("- "):
            if not in_list:
                out.append('<ul class="r-list">')
                in_list = True
            out.append(f"<li>{inline(s[2:].strip())}</li>")
            i += 1
            continue

        close_list()
        para = [s]
        j = i + 1
        while j < n:
            js = lines[j].strip()
            if not js or js.startswith("#") or js == "---" or js.startswith("- "):
                break
            para.append(js)
            j += 1
        out.append(f'<p class="r-body">{inline(" ".join(para))}</p>')
        i = j

    close_list()
    close_section()
    out.append("</main>")
    return "\n".join(out)


CSS = r"""
@page {
  size: A4;
  margin: 16mm 16mm 18mm 16mm;
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #222;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.55;
  font-feature-settings: "liga" 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
a { color: inherit; text-decoration: none; }
strong { font-weight: 600; color: #111; }
em { font-style: italic; color: #555; }

.r-header {
  padding-bottom: 10pt;
  border-bottom: 0.6pt solid #cfcfcf;
  margin-bottom: 14pt;
}
.r-header h1 {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 500;
  font-size: 26pt;
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0 0 8pt 0;
  color: #111;
}
.r-header .r-meta {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #555;
  margin: 0 0 3pt 0;
}
.r-header .r-meta:first-of-type {
  text-transform: uppercase;
  font-weight: 600;
  font-size: 8.5pt;
  color: #777;
}

main { display: block; }
section {
  padding: 10pt 0 4pt 0;
  border-top: 0.5pt solid #e3e3e3;
  page-break-inside: auto;
  break-inside: auto;
}
section:first-of-type { border-top: none; padding-top: 2pt; }
section h2 {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #777;
  margin: 0 0 10pt 0;
  page-break-after: avoid;
  break-after: avoid;
}

.r-entry {
  margin-bottom: 10pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.r-entry:last-child { margin-bottom: 2pt; }
.r-entry h3 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 12pt;
  font-weight: 600;
  color: #111;
  margin: 0 0 2pt 0;
  line-height: 1.3;
  page-break-after: avoid;
  break-after: avoid;
}
.r-entry-meta {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #666;
  margin-bottom: 4pt;
}
.r-entry-meta strong { font-weight: 600; color: #333; }
.r-entry p {
  margin: 4pt 0 0 0;
  color: #333;
  font-size: 10pt;
  line-height: 1.55;
}

p.r-body {
  margin: 0 0 6pt 0;
  color: #333;
  font-size: 10.5pt;
  line-height: 1.6;
}

ul.r-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
ul.r-list li {
  position: relative;
  padding-left: 11pt;
  margin-bottom: 5pt;
  font-size: 10pt;
  line-height: 1.5;
  color: #333;
  page-break-inside: avoid;
  break-inside: avoid;
}
ul.r-list li::before {
  content: '·';
  position: absolute;
  left: 2pt;
  top: -2pt;
  color: #999;
  font-weight: 700;
  font-size: 14pt;
}
ul.r-list li strong { color: #111; }
ul.r-list li em { color: #666; }
ul.r-list li a {
  color: #111;
  text-decoration: underline;
  text-decoration-color: #bbb;
  text-decoration-thickness: 0.4pt;
  text-underline-offset: 2pt;
}
"""


def build_html(body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vaiva Kalnikaitė — Résumé</title>
<meta name="author" content="Vaiva Kalnikaitė">
<meta name="description" content="Résumé of Vaiva Kalnikaitė — PhD, FRSA, Head of UX.">
<meta name="keywords" content="UX, Design Leadership, Human-AI Interaction, Agentic AI, HCI, Design Research, Amazon, AWS, Dovetailed">
<style>{CSS}</style>
</head>
<body>
{body_html}
</body>
</html>
"""


def build_variant(md, suffix, subtitle):
    if subtitle:
        md = md.replace(BASE_SUBTITLE, subtitle, 1)
    body = md_to_html(md)
    html = build_html(body)
    html_out = ROOT / f"resume{suffix.lower()}.html"
    pdf_out = ROOT / f"Vaiva_Kalnikaite_Resume{suffix}.pdf"
    html_out.write_text(html, encoding="utf-8")

    url = html_out.resolve().as_uri()
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        f"--print-to-pdf={pdf_out}",
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not pdf_out.exists():
        sys.stderr.write(r.stderr)
        sys.exit(r.returncode or 1)
    print(f"wrote {pdf_out.name}  ({pdf_out.stat().st_size // 1024} KB)")


def main() -> None:
    if not SRC.exists():
        sys.exit(f"error: {SRC} not found")
    md = SRC.read_text(encoding="utf-8")
    for variant in VARIANTS:
        build_variant(md, variant["suffix"], variant["subtitle"])


if __name__ == "__main__":
    main()
