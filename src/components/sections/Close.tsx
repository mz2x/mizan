import Link from "next/link";
import { SOURCE_URL } from "@/content/units";
import type { Dictionary, Locale } from "@/lib/i18n";
import { IconArrow } from "@/components/icons";
import s from "./sections.module.css";
import { localePath } from "@/lib/paths";

/** Blind-embossed dry seal: the page's closing statement, pressed into the paper (raster plate). */
function DrySeal() {
  return (
    <picture className={s.drySeal}>
      <source srcSet="/assets/plates/dry-seal.webp" type="image/webp" />
      <img src="/assets/plates/dry-seal.png" alt="" width={640} height={640} loading="lazy" decoding="async" />
    </picture>
  );
}

export function Close({ t, lang }: { t: Dictionary; lang: Locale }) {
  return (
    <section className={`${s.section} ${s.closing}`} data-section aria-labelledby="close-title">
      <div className={s.inner}>
        <div className={s.sealRow}>
          <DrySeal />
          <div>
            <h2 id="close-title" className={`${s.h2} ${s.embossed}`}>
              {t.close.seal}
            </h2>
            <p className={s.body}>{t.close.sealSub}</p>
            <p className={s.body}>{t.close.residency}</p>
          </div>
        </div>

        <div className={s.closeActions}>
          <Link href={localePath(lang, "/review")} className={`btn ${s.bigBtn}`}>
            {t.close.cta}
            <IconArrow className="btn-arrow" />
          </Link>
          <Link href={localePath(lang, "/how")} className={`btn btn-ghost ${s.bigBtn}`}>
            {t.nav.how}
          </Link>
        </div>

        <footer className={s.colophon}>
          <p>
            {t.close.source}{" "}
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              {t.close.sourceLink}
            </a>
          </p>
          <p>{t.close.demoNote}</p>
          <p>{t.close.team}</p>
        </footer>
      </div>
    </section>
  );
}
