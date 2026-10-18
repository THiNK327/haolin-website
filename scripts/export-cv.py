"""Export the owner-supplied CV v6 text as a downloadable PDF.

Optional maintenance task, never part of a visitor request or the Cloudflare build.
Install weasyprint==68.0 and Liberation Serif to regenerate; --check-only uses stdlib.
The text fingerprint was computed directly from all 122 paragraphs in the uploaded DOCX.
"""
from __future__ import annotations
import argparse
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/Haolin_Wang_Academic_CV_v6.html'
OUTPUT = ROOT / 'public/Haolin_Wang_Academic_CV_v6.pdf'
ALIAS = ROOT / 'public/Haolin_Wang_CV.pdf'
TEXT_SHA256 = '34f5c37cd3baafa0691927727355b59422424fc81c52b1fcc38d16f2c2812cec'
DOCX_SHA256 = '2e05af283309571e1b529bd586e41bcbc1f9a9757b24b520af4463a96a76ef37'

class Paragraphs(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.parts: list[str] | None = None
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ('p', 'h1', 'h2', 'h3'):
            if self.parts is not None:
                raise ValueError('Nested CV paragraph')
            self.parts = []
    def handle_data(self, data: str) -> None:
        if self.parts is not None:
            self.parts.append(data)
    def handle_endtag(self, tag: str) -> None:
        if tag in ('p', 'h1', 'h2', 'h3') and self.parts is not None:
            self.paragraphs.append(' '.join(''.join(self.parts).split()))
            self.parts = None

def verify_source() -> None:
    parser = Paragraphs()
    parser.feed(SOURCE.read_text(encoding='utf-8'))
    digest = hashlib.sha256('\n'.join(parser.paragraphs).encode('utf-8')).hexdigest()
    if len(parser.paragraphs) != 122 or digest != TEXT_SHA256:
        raise ValueError(f'CV differs from uploaded v6: {len(parser.paragraphs)} paragraphs; SHA256={digest}')
    print('PASS: all 122 CV paragraphs match the owner-supplied v6 text fingerprint.')

def verify_outputs() -> None:
    data = OUTPUT.read_bytes()
    if not data.startswith(b'%PDF-') or len(data) < 20_000:
        raise ValueError('CV PDF is missing or invalid')
    if ALIAS.read_bytes() != data:
        raise ValueError('The legacy CV URL must serve the current CV too')
    print(f'PASS: versioned CV and legacy alias contain the same PDF ({len(data)} bytes).')

def main() -> None:
    args = argparse.ArgumentParser()
    args.add_argument('--check-only', action='store_true')
    options = args.parse_args()
    verify_source()
    if not options.check_only:
        from weasyprint import HTML
        document = HTML(filename=str(SOURCE)).render()
        if len(document.pages) != 5:
            raise ValueError(f'Expected a five-page CV, got {len(document.pages)}; review the layout before publishing.')
        document.write_pdf(str(OUTPUT))
        shutil.copyfile(OUTPUT, ALIAS)
    verify_outputs()

if __name__ == '__main__':
    main()
