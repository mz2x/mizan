/** Authored icons: one 1.6px stroke, round joins, drawn on a 24px grid. */
type P = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconCheck = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

export const IconUpload = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
    <path d="M4.5 14.5v3.2c0 1 .8 1.8 1.8 1.8h11.4c1 0 1.8-.8 1.8-1.8v-3.2" />
  </svg>
);

export const IconArrow = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
