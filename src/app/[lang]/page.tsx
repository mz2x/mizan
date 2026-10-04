import { notFound } from "next/navigation";
import { Hero } from "@/components/hero/Hero";
import { Presenter } from "@/components/Presenter";
import { SectionRail } from "@/components/SectionRail";
import { StampReveal } from "@/components/StampReveal";
import { Abstain } from "@/components/sections/Abstain";
import { Close } from "@/components/sections/Close";
import { Measures } from "@/components/sections/Measures";
import { Overrule } from "@/components/sections/Overrule";
import { Register } from "@/components/sections/Register";
import { TermGap } from "@/components/sections/TermGap";
import { HowMachine } from "@/components/how/HowMachine";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <main>
      <Presenter />
      <StampReveal />
      <SectionRail label={t.nav.sections} />
      <Hero t={t} lang={lang} />
      <Register t={t} lang={lang} />
      {/* The real-clause walkthrough, the same component as on /how (Mazen, 2026-10-03). */}
      <HowMachine t={t} lang={lang} />
      <TermGap t={t} lang={lang} />
      <Overrule t={t} lang={lang} />
      <Abstain t={t} lang={lang} />
      <Measures t={t} lang={lang} />
      <Close t={t} lang={lang} />
    </main>
  );
}
