// A plate with a fork and a knife, in one flat colour. Decorative: the name beside it carries the meaning.
export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="10" fill="currentColor" />
      <circle className="logo-stroke" cx="24" cy="24" r="9" fill="none" strokeWidth="2.4" />
      <g className="logo-stroke" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M10 13v8M12.5 13v8M15 13v8M12.5 21v14" />
        <path d="M38 13c-3 2-3 9-3 12h3v10" />
      </g>
    </svg>
  );
}
