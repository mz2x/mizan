import type { Verdict } from "@/content/demo";
import type { Locale } from "@/lib/i18n";
import { displayId } from "@/lib/format";
import s from "./stamp.module.css";

const PLATE: Record<Verdict, { file: string; aspect: string }> = {
  nonCompliant: { file: "stamp-red", aspect: "1467 / 876" },
  review: { file: "stamp-bracket", aspect: "1495 / 763" },
  abstain: { file: "stamp-dashed", aspect: "1394 / 781" },
  compliant: { file: "stamp-round", aspect: "772 / 784" },
};

/** A verdict as a rubber-stamp impression: the plate is the ink frame, the words are real text. */
export function Stamp({
  verdict,
  label,
  citation,
  lang,
  className,
}: {
  verdict: Verdict;
  label: string;
  citation?: string | null;
  lang: Locale;
  className?: string;
}) {
  const plate = PLATE[verdict];
  return (
    <span className={`${s.stamp} ${s[verdict]} ${className ?? ""}`} style={{ aspectRatio: plate.aspect }}>
      <picture>
        <source srcSet={`/assets/plates/${plate.file}.webp`} type="image/webp" />
        <img src={`/assets/plates/${plate.file}.png`} alt="" className={s.plate} />
      </picture>
      <span className={`${s.word} ink-grain`}>{label}</span>
      {citation && verdict === "nonCompliant" && (
        <bdi dir="rtl" className={`${s.id} ink-grain`}>{displayId(citation, lang)}</bdi>
      )}
    </span>
  );
}
