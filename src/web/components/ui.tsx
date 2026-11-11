import type { CSSProperties } from "react";

const ICONS = {
  today: "M4 10.5h16M7 3v3m10-3v3M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Zm2.5 9.5 2.2 2.2 4.8-4.7",
  records: "M5 19V9m7 10V4m7 15v-6M3 21h18",
  posture: "M12 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 9l5-2 5 2m-5-2v6m0 0-4 8m4-8 4 8",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  check: "M5 12.5 10 17l9-10",
  right: "M9 5l7 7-7 7",
  left: "M15 5l-7 7 7 7",
  shield: "M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3Z",
  play: "M8 5v14l11-7-11-7Z",
  swap: "M4 8h13l-3-3M20 16H7l3 3",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  book: "M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4Zm0 12a4 4 0 0 1 4-4h9",
  alert: "M12 9v4.5m0 3v.5M10.3 4 2.7 17.5a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z",
  refresh: "M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.5",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 7V4h4v3m-8 0 1 13h10l1-13"
} as const;

export type IconName = keyof typeof ICONS;

/** One set of line icons for the whole app. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** 0-10 pick-one scale (two rows of big targets). `before` rings the value from before the workout. */
export function PainScale({
  value,
  onChange,
  before = null,
  label
}: {
  value: number | null;
  onChange: (score: number) => void;
  before?: number | null;
  label: string;
}) {
  return (
    <>
      <div className="pain-scale" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            className={["pain-scale-dot", value === score ? "selected" : "", before === score ? "before" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="pain-scale-ends">
        <span>没有不适</span>
        <span>很痛</span>
      </div>
    </>
  );
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  label
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      style={{ "--n": options.length } as CSSProperties}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "on" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
