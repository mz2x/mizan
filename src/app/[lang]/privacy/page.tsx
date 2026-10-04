import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { localePath } from "@/lib/paths";
import s from "./privacy.module.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: `${t.privacy.title} — ${t.hero.name}` };
}

// The privacy notice the PDPL implementing regulation (Art. 4(1)) asks for; its content follows
// الوثائق/04_الخصوصية_والأمن.md, requirement 6. Claims stay within what the code does.
export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const p = t.privacy;
  return (
    <main className={s.page}>
      <article className={s.card}>
        <nav className={s.back}>
          <Link href={localePath(lang, "/review")}>{t.review.title}</Link>
          {" · "}
          <Link href={localePath(lang)}>{t.review.back}</Link>
        </nav>
        <h1 className={s.title}>{p.title}</h1>
        <p className={s.updated}>{p.updated}</p>
        <p className={s.intro}>{p.intro}</p>
        {p.sections.map((sec) => (
          <section key={sec.h} className={s.section}>
            <h2>{sec.h}</h2>
            <p>{sec.p}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
