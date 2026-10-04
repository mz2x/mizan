import type { Metadata } from "next";
import { Markazi_Text, Readex_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { dir, getDictionary, hasLocale, locales } from "@/lib/i18n";
import "../globals.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

const markazi = Markazi_Text({
  subsets: ["arabic", "latin"],
  variable: "--font-markazi",
  display: "swap",
});

export const generateStaticParams = () => locales.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang} dir={dir(lang)} className={`${readex.variable} ${markazi.variable}`}>
      <body>{children}</body>
    </html>
  );
}
