#!/usr/bin/env python3
"""Descarga iconos de Fluent Emoji (Microsoft, licencia MIT) a la carpeta icons/.

Uso:
  python3 scripts/add_icon.py carrot banana          # guarda icons/carrot.svg e icons/banana.svg
  python3 scripts/add_icon.py --buscar cake          # lista los nombres que contienen "cake"

Los nombres son los del catálogo https://icon-sets.iconify.design/fluent-emoji/
Solo usa la biblioteca estándar de Python y necesita conexión a internet.
"""
import io, json, os, sys, tarfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, 'icons')
PKG = 'https://registry.npmjs.org/@iconify-json/fluent-emoji/latest'


def load_set():
    meta = json.load(urllib.request.urlopen(PKG))
    data = urllib.request.urlopen(meta['dist']['tarball']).read()
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        return json.load(tar.extractfile('package/icons.json'))


def body(icon_set, name):
    if name in icon_set['icons']:
        return icon_set['icons'][name]['body']
    alias = icon_set.get('aliases', {}).get(name)
    return body(icon_set, alias['parent']) if alias else None


def main(args):
    if not args:
        print(__doc__); return 1
    icon_set = load_set()
    if args[0] in ('--buscar', '--search'):
        term = ' '.join(args[1:]).lower()
        names = sorted(n for n in list(icon_set['icons']) + list(icon_set.get('aliases', {})) if term in n)
        print('\n'.join(names) or 'Ningún icono contiene ese texto.')
        return 0
    os.makedirs(ICONS, exist_ok=True)
    status = 0
    for name in args:
        b = body(icon_set, name)
        if b is None:
            print(f'✗ {name}: no existe. Prueba con --buscar {name.split("-")[0]}'); status = 1; continue
        with open(os.path.join(ICONS, f'{name}.svg'), 'w', encoding='utf-8') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">{b}</svg>\n')
        print(f'✓ icons/{name}.svg')
    return status


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
