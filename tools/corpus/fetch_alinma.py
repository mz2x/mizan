#!/usr/bin/env python3
"""سحب قرارات اللجنة الشرعية لمصرف الإنماء من موقعه العام، وتقطيعها إلى وحدات استشهاد.

المصدر: https://alinma.com/About-the-Bank/Shariah-Board/Sharia-Committee-Releases
الموقع نفسه يستدعي هاتين الواجهتين من المتصفح (shariah.js):
  POST /api/sitecore/shariah/GetDecisionList     -> قائمة قرارات لبحث
  POST /api/sitecore/shariah/GetDecisionDetails  -> نص قرار كامل

الاستخدام:
  python3 fetch_alinma.py                 # يبحث بالكلمات الافتراضية ويسحب ما لم يُسحب
  python3 fetch_alinma.py --ids 7 34 388  # قرارات محددة
  python3 fetch_alinma.py --parse-only    # يعيد التقطيع من النسخ المحفوظة بلا شبكة

المخرجات في data/corpus/ (لا تُرفع إلى git):
  raw/<رقم>.html      الاستجابة الخام كما وصلت (للتوثيق)
  decisions.jsonl     قرار لكل سطر: الرقم، العنوان، التاريخ، النص الكامل، الإحالات
  units.jsonl         وحدة استشهاد لكل سطر: بند (أولاً، ثانياً...) أو ضابط مرقم داخله

مكتبة بايثون القياسية فقط. يسحب ببطء (ثانيتان بين الطلبات افتراضيًا) ويعيد استخدام المحفوظ.
"""
import argparse
import datetime
import html
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://alinma.com/api/sitecore/shariah"
PAGE_URL = "https://alinma.com/About-the-Bank/Shariah-Board/Sharia-Committee-Releases"
SEARCH_SETTING = "d5e30750-16c4-4c72-b517-610d34df6e9a"  # من الحقل المخفي hdnSearchSettindDatasource
UA = "Mozilla/5.0 (Macintosh) Mizan-research (KSU student hackathon)"

OUT = Path(__file__).resolve().parents[2] / "data" / "corpus"
RAW = OUT / "raw"

# البحث في الموقع يطابق الكلمة بصيغتها (مرابحة != المرابحة)، فنذكر الصيغتين.
DEFAULT_TEXT_TERMS = ["مرابحة", "المرابحة", "التورق", "بيع العينة", "العينة", "وعد ملزم"]
DEFAULT_TITLE_TERMS = ["البيع الآجل", "الإجارة", "المرابحة"]

ITEM_RE = re.compile(r"^(\d+)\s*(?:[-–)]|\.(?!\d))\s*(.*)")

ORDINALS = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "سادساً", "سابعاً", "ثامناً",
            "تاسعاً", "عاشراً", "حادي عشر", "ثاني عشر", "ثالث عشر", "رابع عشر", "خامس عشر"]


def post(endpoint, payload, tries=4):
    for attempt in range(tries):
        try:
            return _post(endpoint, payload)
        except Exception as e:  # انقطاع شبكة أو خطأ خادم مؤقت
            if attempt == tries - 1:
                raise
            wait = 10 * (attempt + 1)
            print(f"  خطأ ({e})، إعادة بعد {wait} ث", file=sys.stderr)
            time.sleep(wait)


def _post(endpoint, payload):
    req = urllib.request.Request(
        f"{BASE}/{endpoint}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": UA},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def search(title=None, text=None):
    payload = {
        "SearchType": "decision",
        "SearchSetting": SEARCH_SETTING,
        "SearchByDecision": {"DecisionTitle": title, "DecisionText": text,
                             "DecisionNo": "", "chapterId": None, "FromPage": None},
        "SearchByOrganization": {"OrganizationId": None, "ReleatedMainSubjectId": None,
                                 "RelatedSubjectId": None},
        "SearchByChapter": {"ChapterId": ""},
    }
    body = post("GetDecisionList", payload)
    return sorted({int(n) for n in re.findall(r'data-decision-id="(\d+)"', body)})


def fetch_decision(n):
    return post("GetDecisionDetails", {"decisionNo": str(n), "SearchSetting": SEARCH_SETTING})


def normalize(s):
    """نسخة للبحث فقط: تحذف التطويل والتشكيل وتوحد الألف. النص الحرفي يبقى في text."""
    s = s.replace("ـ", "")
    s = re.sub(r"[ً-ْ]", "", s)
    s = re.sub(r"[إأآ]", "ا", s)
    return re.sub(r"\s+", " ", s).strip()


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace('""', '"')  # الموقع يضاعف علامات التنصيص في القرارات الأحدث
    return re.sub(r"[ \t]+", " ", s).strip()


def parse(n, raw):
    m = re.search(r"<h3[^>]*>(.*?)</h3>", raw, re.S)
    if not m:
        return None
    title = clean(m.group(1))
    title = re.sub(r"^.*?\(\s*\d+\s*\)\s*:\s*", "", title)

    body = raw[m.end():].replace("<\\b>", "</b>")  # القرار (943) يغلق الوسم بـ<\\b>
    body = body[:body.find("</td>")] if "</td>" in body else body
    # نعلّم البنود قبل حذف الوسوم: <b>ثالثاً</b>: — في بداية السطر فقط، لأن القرار (1065)
    # فيه «أولاً» عريضة وسط جملة. وبعض القرارات تكتب «أولا/ثانيا» بلا تنوين؛ نقبلها ونوحّد الاسم.
    ord_re = "|".join(o.replace("ا", "[اأ]").replace("ً", "ً?") for o in ORDINALS)
    canon = {normalize(o): o for o in ORDINALS}
    body = re.sub(rf"^[ \t]*<b>\s*({ord_re})\s*</b>\s*:",
                  lambda mm: f"@@SEC@@{canon.get(normalize(mm.group(1)), mm.group(1))}@@", body, flags=re.M)
    # قرارات بلا بنود مرقمة: منطوقها يبدأ بعد <b>قررت الهيئة</b> مباشرة، فنجعله بندًا اسمه «القرار»
    body = re.sub(r"<b>\s*(قررت\s+(?:الهيئة|اللجنة))\s*</b>", r"\n@@SEC@@القرار@@\1", body)
    lines = [clean(l) for l in body.split("\n")]
    lines = [l for l in lines if l]

    def render(line):
        sm = re.match(r"@@SEC@@(.+?)@@\s*(.*)", line)
        if not sm:
            return line
        return sm.group(2) if sm.group(1) == "القرار" else f"{sm.group(1)}: {sm.group(2)}"

    # المنطوق يبدأ من «قررت الهيئة»؛ ما قبله مقدمة حتى لو رُقِّم بأولاً وثانياً (وصف الطلب)
    start = next((i for i, l in enumerate(lines) if l.startswith("@@SEC@@القرار@@")), 0)
    preamble, sections, cur = [render(l) for l in lines[:start]], [], None
    plain_ord = re.compile(rf"^({ord_re})\s*:\s*(.*)")  # بعض القرارات تكتب «أولاً:» بلا <b>
    for line in lines[start:]:
        sm = re.match(r"@@SEC@@(.+?)@@\s*(.*)", line) or (start and plain_ord.match(line))
        if sm:
            label = canon.get(normalize(sm.group(1)), sm.group(1))
            cur = {"label": label, "lead": sm.group(2), "items": []}
            sections.append(cur)
        elif cur is None:
            preamble.append(line)
        elif ITEM_RE.match(line) and int(ITEM_RE.match(line).group(1)) == len(cur["items"]) + 1:
            num, rest = ITEM_RE.match(line).groups()
            cur["items"].append({"n": int(num), "text": rest})
        # ترقيم فرعي داخل ضابط (القرار 2) يبقى جزءًا من الضابط الذي قبله
        elif cur["items"]:
            cur["items"][-1]["text"] += "\n" + line
        else:
            cur["lead"] += "\n" + line

    # إن تلت «قررت الهيئة ما يأتي:» بنودٌ مرقمة، فهي البنود، والسطر نفسه ليس وحدة
    if len(sections) > 1 and sections[0]["label"] == "القرار" and not sections[0]["items"]:
        sections = sections[1:]
    for sec in sections:
        if sec["label"] == "القرار":
            sec["lead"] = re.split(r"\n(?=أما بعد|وصلى الله)", sec["lead"])[0]

    closing = "وصلى الله وسلم"
    if sections:
        last = sections[-1]
        tgt = last["items"][-1] if last["items"] else last
        key = "text" if last["items"] else "lead"
        if closing in tgt[key]:
            tgt[key] = tgt[key][:tgt[key].find(closing)].rstrip()

    full = "\n".join(render(l) for l in lines)

    head = " ".join(preamble[:3]).replace("\u200f", "").replace("\u200e", "")
    head = re.sub(r"\s*([\\/])\s*", r"\1", head)
    hijri = re.search(r"(\d{1,2}(?:و\d{1,2})?[\\/]\d{1,2}[\\/]\d{4})\s*هـ", head)
    greg = re.search(r"(\d{1,2}(?:و\d{1,2})?[\\/]\d{1,2}[\\/](\d{4}))\s*م", head)
    session = re.search(r"الدورة\s+(\S+)", head)
    refs = sorted({int(x) for x in re.findall(r"القرار\s*\((\d+)\)", full)} - {n})

    return {
        "decision_no": n,
        "title": title,
        "date_hijri": hijri.group(1) if hijri else None,
        "date_gregorian": greg.group(1) if greg else None,
        "year": int(greg.group(2)) if greg else None,
        "session": session.group(1).rstrip("،,") if session else None,
        "refs": refs,
        "preamble": "\n".join(preamble),
        "sections": sections,
        "text": full,
    }


def units_of(d):
    base = {"decision_no": d["decision_no"], "title": d["title"], "year": d["year"],
            "source": "قرارات اللجنة الشرعية لمصرف الإنماء", "source_url": PAGE_URL}
    for s in d["sections"]:
        sid = f"الإنماء/ق{d['decision_no']}/{s['label']}"
        yield {**base, "id": sid, "kind": "section", "section": s["label"], "item": None,
               "text": s["lead"], "context": None, "text_norm": normalize(s["lead"])}
        for it in s["items"]:
            yield {**base, "id": f"{sid}/{it['n']}", "kind": "item", "section": s["label"],
                   "item": it["n"], "text": it["text"], "context": s["lead"],
                   "text_norm": normalize(it["text"])}


RULE_RE = re.compile(r"(لا يجوز|^الا |ان لا |يشترط|يجب|محرم)", re.M)  # على text_norm


def write_readable(decisions, units, manifest):
    """ملف مقروء للفريق: فهرس بسبب دخول كل قرار، ثم النص الكامل."""
    why = {}
    for key, ids in manifest.get("searches", {}).items():
        kind, term = key.split(":", 1)
        for n in ids:
            why.setdefault(n, []).append(f"«{term}» في {'العنوان' if kind == 'title' else 'النص'}")
    ruled = {u["decision_no"] for u in units if RULE_RE.search(u["text_norm"])}

    out = ["# قرارات اللجنة الشرعية لمصرف الإنماء — المسحوبة لمِيزان", "",
           f"المصدر: {PAGE_URL}  ",
           f"آخر سحب: {manifest.get('last_fetch', '—')}. عدد القرارات: {len(decisions)}. "
           f"وحدات الاستشهاد: {len(units)}. القرارات التي فيها لغة منع أو شرط: {len(ruled)}.", "",
           "هذا الملف يُولَّد تلقائيًا من `fetch_alinma.py` — لا تعدّله يدويًا. طريقة الاختيار في `data/README.md`.", "",
           "## الفهرس", "",
           "| القرار | التاريخ | العنوان | لماذا دخل | فيه منع/شرط |", "|---|---|---|---|---|"]
    for d in decisions:
        n = d["decision_no"]
        title = d["title"].replace("|", "/")
        out.append(f"| [{n}](#ق{n}) | {d['date_gregorian'] or '—'} | {title} | "
                   f"{'، '.join(why.get(n, ['—']))} | {'✓' if n in ruled else ''} |")
    out.append("")
    for d in decisions:
        n = d["decision_no"]
        out += ["---", "", f'<a id="ق{n}"></a>', f"## القرار ({n}): {d['title']}", "",
                f"{d['date_hijri'] or '—'}هـ — {d['date_gregorian'] or '—'}م · الدورة {d['session'] or '—'}"
                + (f" · يحيل إلى: {', '.join(map(str, d['refs']))}" if d["refs"] else ""), ""]
        for sec in d["sections"]:
            label = "" if sec["label"] == "القرار" else f"**{sec['label']}** `الإنماء/ق{n}/{sec['label']}`: "
            out += [label + sec["lead"].replace("\n", "  \n"), ""]
            for it in sec["items"]:
                out += [f"{it['n']}. `…/{it['n']}` " + it["text"].replace("\n", "  \n")]
            if sec["items"]:
                out.append("")
        out += ["<details><summary>مقدمة القرار</summary>", "", d["preamble"].replace("\n", "  \n"), "",
                "</details>", ""]
    (OUT / "القرارات_المسحوبة.md").write_text("\n".join(out), "utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ids", type=int, nargs="*", help="أرقام قرارات محددة بدل البحث")
    ap.add_argument("--all", type=int, metavar="N", help="كل القرارات من 1 إلى N (آخر منشور: 1220)")
    ap.add_argument("--text-terms", nargs="*", default=DEFAULT_TEXT_TERMS)
    ap.add_argument("--title-terms", nargs="*", default=DEFAULT_TITLE_TERMS)
    ap.add_argument("--delay", type=float, default=2.0, help="ثوانٍ بين الطلبات (لكل عامل)")
    ap.add_argument("--workers", type=int, default=1, help="طلبات متوازية (افتراضيًا 1)")
    ap.add_argument("--parse-only", action="store_true", help="لا شبكة؛ أعد التقطيع من raw/")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else {"searches": {}}

    if not args.parse_only:
        if args.all:
            args.ids = list(range(1, args.all + 1))
        ids = set(args.ids or [])
        if not args.ids:
            for t in args.text_terms:
                found = search(text=t)
                manifest["searches"][f"text:{t}"] = found
                print(f"بحث نصي «{t}»: {len(found)}", file=sys.stderr)
                ids |= set(found)
                time.sleep(args.delay)
            for t in args.title_terms:
                found = search(title=t)
                manifest["searches"][f"title:{t}"] = found
                print(f"بحث عنوان «{t}»: {len(found)}", file=sys.stderr)
                ids |= set(found)
                time.sleep(args.delay)
        todo = sorted(n for n in ids if not (RAW / f"{n}.html").exists())
        print(f"المطلوب {len(ids)} قرارًا، الجديد منها {len(todo)}", file=sys.stderr)
        empty = manifest.setdefault("empty", [])
        done = iter(range(1, len(todo) + 1))

        def grab(n):
            raw = fetch_decision(n)
            if "<h3" in raw:
                (RAW / f"{n}.html").write_text(raw, "utf-8")
            else:  # رقم بلا قرار منشور
                empty.append(n)
            print(f"  [{next(done)}/{len(todo)}] القرار {n}{'' if '<h3' in raw else ': فارغ'}",
                  file=sys.stderr, flush=True)
            time.sleep(args.delay)

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            list(pool.map(grab, todo))
        manifest["last_fetch"] = datetime.datetime.now().isoformat(timespec="seconds")
        manifest["endpoint"] = BASE
        manifest["page"] = PAGE_URL

    decisions, units, failed = [], [], []
    for p in sorted(RAW.glob("*.html"), key=lambda p: int(p.stem)):
        d = parse(int(p.stem), p.read_text("utf-8"))
        if not d or not d["sections"]:
            failed.append(int(p.stem))
            continue
        decisions.append(d)
        units.extend(units_of(d))

    with open(OUT / "decisions.jsonl", "w", encoding="utf-8") as f:
        for d in decisions:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    with open(OUT / "units.jsonl", "w", encoding="utf-8") as f:
        for u in units:
            f.write(json.dumps(u, ensure_ascii=False) + "\n")
    manifest["decisions"] = len(decisions)
    manifest["units"] = len(units)
    manifest["unparsed"] = failed
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    write_readable(decisions, units, manifest)

    print(f"قرارات: {len(decisions)} | وحدات استشهاد: {len(units)} | لم تُقطّع: {failed}", file=sys.stderr)


if __name__ == "__main__":
    main()
