interface WordmarkProps {
  size?: "sm" | "lg";
  showTagline?: boolean;
}

/**
 * Original vector wordmark: an angular "A" formed from two beams meeting at
 * a lit apex, echoing the Blitz mask motif without referencing any external
 * brand. Placeholder identity for Aether Studio Suite.
 */
export function Wordmark({ size = "lg", showTagline = false }: WordmarkProps): JSX.Element {
  const mark = size === "lg" ? 96 : 40;
  const title = size === "lg" ? "text-4xl" : "text-xl";

  return (
    <div className="flex items-center gap-4">
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon points="48,10 86,86 62,86 48,54 34,86 10,86" fill="#B08D57" />
        <polygon points="48,10 86,86 68,86 48,42 28,86 10,86" fill="#1B1F27" />
        <rect x="41" y="46" width="14" height="14" rx="3" fill="#3E8EF7" />
      </svg>
      <div>
        <div className={`${title} font-semibold tracking-wide text-cream`}>Aether Studio Suite</div>
        {showTagline && <div className="text-sm text-silver">From imagination to final cut.</div>}
      </div>
    </div>
  );
}
