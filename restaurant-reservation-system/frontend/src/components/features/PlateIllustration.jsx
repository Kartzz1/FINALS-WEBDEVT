// A flat, drawn salad plate used in the hero until a real photograph is configured
// (see config/brand.js). Colours come from tokens, so it follows the theme.
const LEAVES = [
  { x: 315, y: 200, angle: 0, tone: "a" },
  { x: 293, y: 268, angle: 36, tone: "b" },
  { x: 235, y: 309, angle: 72, tone: "c" },
  { x: 165, y: 309, angle: 108, tone: "a" },
  { x: 107, y: 268, angle: 144, tone: "b" },
  { x: 85, y: 200, angle: 180, tone: "c" },
  { x: 107, y: 132, angle: 216, tone: "a" },
  { x: 165, y: 91, angle: 252, tone: "b" },
  { x: 235, y: 91, angle: 288, tone: "c" },
  { x: 293, y: 132, angle: 324, tone: "a" },
];
const TOMATOES = [
  [118, 170],
  [285, 150],
  [305, 245],
  [128, 262],
  [215, 298],
];
const CARROTS = ["M108 228q18-12 38-4", "M262 118q20 8 34 24", "M250 272q22-4 36 10", "M120 128q16 10 22 28"];
const PEPPERS = ["M268 200q20-14 38-4", "M96 205q16-16 36-10"];
const SLICE_OFFSETS = [-44, -22, 0, 22, 44];

export default function PlateIllustration() {
  return (
    <svg className="plate" viewBox="0 0 400 400" role="img" aria-label="A plated grilled chicken salad">
      <circle className="plate-ring" cx="200" cy="200" r="196" />
      <circle className="plate-base" cx="200" cy="200" r="158" />
      <circle className="plate-rim" cx="200" cy="200" r="140" />
      {LEAVES.map((leaf) => (
        <ellipse
          key={`${leaf.x}-${leaf.y}`}
          className={`plate-leaf-${leaf.tone}`}
          cx={leaf.x}
          cy={leaf.y}
          rx="34"
          ry="15"
          transform={`rotate(${leaf.angle} ${leaf.x} ${leaf.y})`}
        />
      ))}
      <g transform="rotate(-20 200 200)">
        {SLICE_OFFSETS.map((offset) => (
          <g key={offset}>
            <rect className="plate-meat" x="138" y={200 + offset - 14} width="124" height="28" rx="13" />
            <path
              className="plate-grill"
              d={[160, 184, 208, 232].map((x) => `M${x} ${200 + offset - 8}l6 16`).join("")}
            />
          </g>
        ))}
      </g>
      {PEPPERS.map((d) => (
        <path key={d} className="plate-pepper" d={d} />
      ))}
      {CARROTS.map((d) => (
        <path key={d} className="plate-carrot" d={d} />
      ))}
      {TOMATOES.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle className="plate-tomato" cx={x} cy={y} r="13" />
          <circle className="plate-tomato-light" cx={x + 4} cy={y - 4} r="4" />
        </g>
      ))}
    </svg>
  );
}
