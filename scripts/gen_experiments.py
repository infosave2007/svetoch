#!/usr/bin/env python3
"""Generate the bilingual experiments catalog (docs/EXPERIMENTS.md and
docs/EXPERIMENTS.ru.md) from the per-stage translation files in app/stages/.

Each stage folder contains stageN_token.json with the structure:
    { "ru": {"name", "description", "description_all"},
      "en": {...},
      "mirrorless": bool }

Run from the repo root:  python scripts/gen_experiments.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAGES = ROOT / "app" / "stages"
DOCS = ROOT / "docs"

HEADER = {
    "en": {
        "switch": "🇷🇺 [Русская версия](EXPERIMENTS.ru.md)",
        "title": "# Experiment Catalog",
        "intro": (
            "This repository ships **{n} optical-computing experiments** grouped into "
            "four families. Every experiment runs on the phone (`index.html`), is launched "
            "from the admin dashboard (`/admin`), and reports a pass/fail metric back to the "
            "server, which stores the full run as JSON in `logs/`.\n\n"
            "Each entry below lists the short description and the detailed physical / "
            "algorithmic explanation taken directly from the experiment's metadata. "
            "A 🪞 marker means the experiment **requires the mirror**; a 📵 marker means it "
            "also works **without the mirror** (used as a control / device-only test)."
        ),
        "toc": "## Contents",
        "mirror_yes": "🪞 requires mirror",
        "mirror_no": "📵 works without mirror (control)",
        "stages_word": "experiments",
    },
    "ru": {
        "switch": "🇬🇧 [English version](EXPERIMENTS.md)",
        "title": "# Каталог экспериментов",
        "intro": (
            "В репозитории представлено **{n} экспериментов оптического вычисления**, "
            "разбитых на четыре группы. Каждый эксперимент выполняется на телефоне "
            "(`index.html`), запускается из админ-панели (`/admin`) и возвращает на сервер "
            "метрику «пройдено/не пройдено»; полный прогон сохраняется в формате JSON в "
            "папке `logs/`.\n\n"
            "Для каждого эксперимента ниже приведены краткое описание и подробное "
            "физическое / алгоритмическое объяснение прямо из метаданных эксперимента. "
            "Метка 🪞 означает, что эксперимент **требует зеркала**; метка 📵 — что он "
            "также работает **без зеркала** (используется как контрольный тест)."
        ),
        "toc": "## Содержание",
        "mirror_yes": "🪞 нужно зеркало",
        "mirror_no": "📵 работает без зеркала (контроль)",
        "stages_word": "экспериментов",
    },
}


def load_sections():
    sections = []
    for cat_dir in sorted(p for p in STAGES.iterdir() if p.is_dir() and not p.name.startswith(".")):
        info = {"ru": cat_dir.name, "en": cat_dir.name}
        info_file = cat_dir / "info.json"
        if info_file.exists():
            info = json.loads(info_file.read_text(encoding="utf-8"))
        stages = []
        for js in sorted(cat_dir.glob("stage*.js"),
                         key=lambda p: int(re.search(r"\d+", p.name).group())):
            m = re.match(r"stage(\d+)_(.+)\.js", js.name)
            if not m:
                continue
            sid, token = int(m.group(1)), m.group(2)
            jf = cat_dir / f"stage{sid}_{token}.json"
            if not jf.exists():
                continue
            data = json.loads(jf.read_text(encoding="utf-8"))
            stages.append({
                "id": sid,
                "token": token,
                "mirrorless": data.get("mirrorless", False),
                "ru": data.get("ru", {}),
                "en": data.get("en", {}),
            })
        sections.append({"dir": cat_dir.name, "info": info, "stages": stages})
    return sections


def anchor(text):
    a = text.lower()
    a = re.sub(r"[^\w\s-]", "", a)
    a = re.sub(r"\s+", "-", a.strip())
    return a


def render(lang, sections):
    H = HEADER[lang]
    total = sum(len(s["stages"]) for s in sections)
    out = []
    out.append(H["switch"])
    out.append("")
    out.append(H["title"])
    out.append("")
    out.append(H["intro"].format(n=total))
    out.append("")

    # Table of contents
    out.append(H["toc"])
    out.append("")
    for s in sections:
        name = s["info"].get(lang, s["dir"])
        out.append(f"- [{name}](#{anchor(name)}) — {len(s['stages'])} {H['stages_word']}")
    out.append("")

    for s in sections:
        name = s["info"].get(lang, s["dir"])
        out.append("---")
        out.append("")
        out.append(f"## {name}")
        out.append("")
        for st in s["stages"]:
            tr = st[lang]
            sname = tr.get("name", f"Stage {st['id']}")
            desc = tr.get("description", "").strip()
            full = tr.get("description_all", "").strip()
            marker = H["mirror_no"] if st["mirrorless"] else H["mirror_yes"]
            out.append(f"### {st['id']}. {sname}")
            out.append("")
            out.append(f"`stage{st['id']}_{st['token']}` · {marker}")
            out.append("")
            if desc:
                out.append(f"*{desc}*")
                out.append("")
            if full:
                # description_all uses literal \n and markdown bold already
                out.append(full)
                out.append("")
    return "\n".join(out).rstrip() + "\n"


def main():
    DOCS.mkdir(exist_ok=True)
    sections = load_sections()
    total = sum(len(s["stages"]) for s in sections)
    (DOCS / "EXPERIMENTS.md").write_text(render("en", sections), encoding="utf-8")
    (DOCS / "EXPERIMENTS.ru.md").write_text(render("ru", sections), encoding="utf-8")
    print(f"Generated catalog for {total} experiments across {len(sections)} sections.")


if __name__ == "__main__":
    main()
