/**
 * Engraved wave field printed over the violet banknote face: fine paper-white sine lines,
 * with Arabic micro-text running along every other line, as on security paper.
 */
const WIDTH = 1536;
const HEIGHT = 595;
const GAP = 19;
const WAVELENGTH = 340;
const AMPLITUDE = 11;

function wavePath(y: number, phase: number) {
  const steps = 48;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WIDTH;
    const yy = y + Math.sin((x / WAVELENGTH) * Math.PI * 2 + phase) * AMPLITUDE;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return d;
}

export function GuillocheField({ microtext, idPrefix }: { microtext: string; idPrefix: string }) {
  const lines = Array.from({ length: Math.ceil(HEIGHT / GAP) + 2 }, (_, i) => ({
    id: `${idPrefix}-w${i}`,
    d: wavePath(i * GAP - GAP, i * 0.35),
    micro: i % 2 === 1,
  }));
  const run = `${microtext} `.repeat(90);

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        {lines.filter((l) => l.micro).map((l) => (
          <path key={l.id} id={l.id} d={l.d} />
        ))}
      </defs>
      <g fill="none" stroke="rgb(244 244 240 / 0.27)" strokeWidth="0.85">
        {lines.map((l) => (
          <path key={l.id} d={l.d} />
        ))}
      </g>
      {/* direction="ltr": an RTL run on a textPath starts off the path's end and never renders.
          The repeated word keeps its Arabic shaping; only the order of identical words flips. */}
      <g fill="rgb(244 244 240 / 0.34)" fontSize="8" style={{ fontFamily: "var(--font-ui)" }}>
        {lines.filter((l) => l.micro).map((l) => (
          <text key={l.id} dy="-2.5" direction="ltr">
            <textPath href={`#${l.id}`}>{run}</textPath>
          </text>
        ))}
      </g>
    </svg>
  );
}
