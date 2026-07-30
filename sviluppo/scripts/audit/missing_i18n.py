#!/usr/bin/env python3
"""Trova stringhe di testo senza data-i18n in una pagina HTML."""
import sys
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results = []
        self.tag_stack = []
        self.attrs_stack = []
    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        self.attrs_stack.append(dict(attrs))
    def handle_endtag(self, tag):
        if self.tag_stack:
            self.tag_stack.pop()
            self.attrs_stack.pop()
    def handle_data(self, data):
        text = data.strip()
        if len(text) < 4 or text.startswith('{') or text.startswith('var '):
            return
        if not self.attrs_stack:
            return
        if self.tag_stack and self.tag_stack[-1] in ('script', 'style', 'code', 'pre', 'svg', 'path'):
            return
        attrs = self.attrs_stack[-1]
        has_i18n = any(k.startswith('data-i18n') for k in attrs)
        if not has_i18n:
            self.results.append((self.tag_stack[-1] if self.tag_stack else '?', text))

for f in sys.argv[1:]:
    ext = TextExtractor()
    ext.feed(open(f, encoding='utf-8').read())
    print(f"\n=== {f}: {len(ext.results)} stringhe senza data-i18n ===")
    for tag, text in ext.results[:40]:
        print(f"  <{tag}> {text[:100]}")
