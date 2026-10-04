import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewApp } from "@/components/review/ReviewApp";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/review">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: `${getDictionary(lang).review.title} — ${getDictionary(lang).hero.name}` };
}

export default async function ReviewPage({ params }: PageProps<"/[lang]/review">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <ReviewApp t={getDictionary(lang)} lang={lang} />;
}
