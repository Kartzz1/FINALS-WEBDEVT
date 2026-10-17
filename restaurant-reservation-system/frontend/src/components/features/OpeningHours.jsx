import { parseOpeningHours } from "../../utils/restaurant.js";

// Shows readable rows when the hours use a simple pattern; otherwise the original
// text, unchanged, so nothing is ever guessed.
export default function OpeningHours({ text }) {
  const rows = parseOpeningHours(text);
  if (!rows) {
    return <p className="hours-raw">{text}</p>;
  }
  return (
    <dl className="hours">
      {rows.map((row) => (
        <div key={`${row.days}-${row.hours}`}>
          <dt>{row.days}</dt>
          <dd>{row.hours}</dd>
        </div>
      ))}
    </dl>
  );
}
