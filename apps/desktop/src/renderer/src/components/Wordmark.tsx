interface WordmarkProps {
  size?: "sm" | "lg";
  showTagline?: boolean;
  /** Icon + short "Aether" label only, no full name -- for tight spaces like the nav sidebar. */
  compact?: boolean;
}

/**
 * Original vector mark: three orbiting circles and a halo ring -- "aether"
 * as the atmosphere a story moves through, "orbit" as the production
 * pipeline carrying it from idea to final cut. Built entirely from circles
 * and ellipses (no squares/polygons) with a bright, hand-tuned gradient, in
 * place of the earlier angular "A" mark and any stock-logo look.
 */
export function Wordmark({ size = "lg", showTagline = false, compact = false }: WordmarkProps): JSX.Element {
  const mark = size === "lg" ? 96 : compact ? 28 : 40;
  const title = size === "lg" ? "text-4xl" : "text-xl";

  return (
    <div className="flex items-center gap-3">
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="aetherOrbitGradient" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF3EA5" />
            <stop offset="55%" stopColor="#7C5CFC" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r="38" stroke="url(#aetherOrbitGradient)" strokeWidth="5" fill="none" />
        <ellipse cx="48" cy="48" rx="20" ry="14" fill="url(#aetherOrbitGradient)" opacity="0.25" />
        <circle cx="48" cy="48" r="13" fill="url(#aetherOrbitGradient)" />
        <circle cx="76" cy="26" r="7" fill="#FFB020" />
      </svg>
      <div>
        <div className={`${compact ? "text-sm" : title} font-semibold tracking-wide text-cream`}>
          {compact ? "Aether" : "Aether Studio Suite"}
        </div>
        {showTagline && <div className="text-sm text-silver">From imagination to final cut.</div>}
      </div>
    </div>
  );
}
