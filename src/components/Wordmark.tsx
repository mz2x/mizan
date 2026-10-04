/**
 * The square-Kufic «مِيزان» logotype, drawn as vector shapes on the grid measured from the original
 * raster plate (public/assets/plates/wordmark.png, 1461×659). One change from the plate: the loose
 * bar under the meem is gone. It belonged to no letter and read as a stray stroke (mentor
 * feedback, 2026-10-01). Fill is currentColor, so the same mark serves the violet hero and the app bar.
 */
const diamond = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
const rect = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}H${x2}V${y2}H${x1}Z`;
/** Same box wound the other way: under the nonzero rule it punches a hole through the shapes below. */
const hole = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}V${y2}H${x2}V${y1}Z`;

const SHAPES = [
  // ن: bowl and its dot
  rect(43, 274, 152, 623),
  rect(43, 508, 455, 623),
  rect(343, 211, 455, 623),
  diamond(227.5, 171.5, 58.5),
  // ا
  rect(517, 38, 628, 499),
  // ز: stem, tail and dot
  rect(733, 209, 845, 623),
  rect(644, 508, 845, 623),
  diamond(790, 140.5, 58.5),
  // baseline joining ز ي م
  rect(733, 371, 1419, 484),
  // ي: tooth and its two dots
  rect(929, 274, 1042, 372),
  diamond(918, 570, 48),
  diamond(1017, 570, 48),
  // م: head with its counter
  rect(1131, 209, 1419, 484),
  hole(1243, 323, 1305, 371),
].join("");

export function Wordmark({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="43 38 1376 585"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={SHAPES} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}
