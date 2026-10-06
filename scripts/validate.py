#!/usr/bin/env python3
"""Comprueba que los JSON de data/ están bien escritos.

Uso:  python3 scripts/validate.py
Sale con código 1 si hay errores (GitHub Actions lo marca en rojo). Los avisos no bloquean.
Solo usa la biblioteca estándar de Python.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
ICONS = os.path.join(ROOT, 'icons')
errors, warnings = [], []

ID_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
VOCAB_FIELDS = {'en', 'ipa', 'pron', 'es', 'icon', 'note', 'example', 'example_es', 'source', 'say'}
VOCAB_REQUIRED = ('en', 'ipa', 'pron', 'es')
UNIT_FIELDS = {'id', 'type', 'level', 'title', 'title_es', 'description', 'sources', 'sections'}
GRAMMAR_FIELDS = {'id', 'title', 'title_es', 'use', 'forms', 'keywords', 'examples', 'mistakes', 'source'}
VOWELS = re.compile(r'[aeiouáéíóúAEIOUÁÉÍÓÚ]+')


def err(where, msg): errors.append(f'{where}: {msg}')
def warn(where, msg): warnings.append(f'{where}: {msg}')


def text_ok(where, value):
    if not isinstance(value, str) or not value.strip():
        err(where, 'debe ser un texto no vacío'); return False
    if '<' in value or '>' in value:
        err(where, 'no uses HTML (< >); para cursiva escribe *así* y para negrita **así**')
    return True


def check_vocab(path, unit):
    sources = unit.get('sources') or {}
    for si, sec in enumerate(unit['sections']):
        items = sec.get('items')
        w = f'{path} › sección «{sec.get("id")}»'
        if not isinstance(items, list) or not items:
            err(w, 'falta la lista "items" o está vacía'); continue
        seen = set()
        for ii, it in enumerate(items):
            wi = f'{w} › palabra {ii + 1} ({it.get("en", "?")})'
            if not isinstance(it, dict):
                err(wi, 'cada palabra debe ser un objeto { }'); continue
            for k in VOCAB_REQUIRED:
                if k not in it: err(wi, f'falta el campo obligatorio "{k}"')
                else: text_ok(f'{wi} › {k}', it[k])
            for k in it:
                if k not in VOCAB_FIELDS: warn(wi, f'campo desconocido "{k}" (no se mostrará)')
            for k in ('note', 'example', 'example_es', 'say'):
                if k in it: text_ok(f'{wi} › {k}', it[k])
            ipa = it.get('ipa', '')
            if isinstance(ipa, str) and ipa.startswith('/'):
                err(wi, 'escribe el AFI sin barras /…/: la página las añade')
            pron = it.get('pron', '')
            if (isinstance(pron, str) and pron == pron.lower()
                    and any(len(VOWELS.findall(w)) > 1 for w in re.split(r'[\s/—]+', pron))):
                warn(wi, f'"pron": «{pron}» no marca la sílaba fuerte en MAYÚSCULAS')
            icon = it.get('icon')
            if icon is not None and not os.path.exists(os.path.join(ICONS, f'{icon}.svg')):
                err(wi, f'el icono "{icon}" no existe en icons/ (añádelo con scripts/add_icon.py {icon})')
            src = it.get('source')
            if src is not None and src not in sources:
                err(wi, f'"source": "{src}" no está definido en "sources" de la unidad')
            if it.get('example_es') and not it.get('example'):
                warn(wi, 'hay "example_es" pero no "example"')
            key = str(it.get('en', '')).lower()
            if key in seen: warn(wi, 'palabra repetida en la misma sección')
            seen.add(key)


def check_grammar(path, unit):
    for sec in unit['sections']:
        w = f'{path} › sección «{sec.get("id")}»'
        for k in sec:
            if k not in GRAMMAR_FIELDS: warn(w, f'campo desconocido "{k}"')
        if 'use' in sec: text_ok(f'{w} › use', sec['use'])
        for i, f in enumerate(sec.get('forms', [])):
            for k in ('label', 'pattern'):
                if k not in f: err(f'{w} › forms {i + 1}', f'falta "{k}"')
        for i, e in enumerate(sec.get('examples', [])):
            for k in ('en', 'es'):
                if k not in e: err(f'{w} › examples {i + 1}', f'falta "{k}"')
                else: text_ok(f'{w} › examples {i + 1} › {k}', e[k])
        for i, m in enumerate(sec.get('mistakes', [])):
            for k in ('wrong', 'right'):
                if k not in m: err(f'{w} › mistakes {i + 1}', f'falta "{k}"')
        if not any(sec.get(k) for k in ('use', 'forms', 'examples', 'mistakes')):
            err(w, 'la sección está vacía: añade al menos "use", "forms", "examples" o "mistakes"')
        if sec.get('source') and sec['source'] not in (unit.get('sources') or {}):
            err(w, f'"source": "{sec["source"]}" no está definido en "sources"')


def main():
    try:
        index = json.load(open(os.path.join(DATA, 'index.json'), encoding='utf-8'))
    except Exception as e:
        print(f'ERROR data/index.json: {e}'); return 1
    listed = index.get('units', [])
    ids = {}
    for rel in listed:
        path = f'data/{rel}'
        full = os.path.join(DATA, rel)
        if not os.path.exists(full):
            err(path, 'aparece en index.json pero el archivo no existe'); continue
        try:
            unit = json.load(open(full, encoding='utf-8'))
        except json.JSONDecodeError as e:
            err(path, f'JSON mal formado en la línea {e.lineno}, columna {e.colno}: {e.msg}'); continue
        for k in ('id', 'type', 'title', 'sections'):
            if k not in unit: err(path, f'falta el campo obligatorio "{k}"')
        for k in unit:
            if k not in UNIT_FIELDS: warn(path, f'campo desconocido "{k}"')
        uid = unit.get('id', '')
        if not ID_RE.match(uid): err(path, '"id" debe ir en minúsculas y con guiones, p. ej. "food-and-cooking"')
        if uid and os.path.splitext(os.path.basename(rel))[0] != uid:
            err(path, f'el nombre del archivo debe coincidir con el id: {uid}.json')
        if uid in ids: err(path, f'el id "{uid}" ya lo usa {ids[uid]}')
        ids[uid] = path
        t = unit.get('type')
        if t not in ('vocabulary', 'grammar'):
            err(path, '"type" debe ser "vocabulary" o "grammar"'); continue
        if not os.path.basename(os.path.dirname(rel)) == ('vocabulary' if t == 'vocabulary' else 'grammar'):
            warn(path, f'las unidades de tipo "{t}" suelen ir en la carpeta data/{t}/')
        secs = unit.get('sections')
        if not isinstance(secs, list) or not secs:
            err(path, '"sections" debe ser una lista con al menos una sección'); continue
        sids = set()
        for s in secs:
            sid = s.get('id', '')
            if not ID_RE.match(sid): err(path, f'sección con "id" no válido: «{sid}»')
            if sid in sids: err(path, f'id de sección repetido: «{sid}»')
            sids.add(sid)
            if 'title' not in s: err(path, f'la sección «{sid}» no tiene "title"')
        (check_vocab if t == 'vocabulary' else check_grammar)(path, unit)
    # files in data/ that are not listed in index.json
    for folder in ('vocabulary', 'grammar'):
        d = os.path.join(DATA, folder)
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                if f.endswith('.json') and f'{folder}/{f}' not in listed:
                    warn(f'data/{folder}/{f}', 'no está en data/index.json, así que no aparecerá en la web')

    for w in warnings: print('AVISO ', w)
    for e in errors: print('ERROR ', e)
    print(f'\n{len(listed)} unidades revisadas: {len(errors)} errores, {len(warnings)} avisos.')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
