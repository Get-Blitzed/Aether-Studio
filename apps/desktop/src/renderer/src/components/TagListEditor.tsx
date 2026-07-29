import { useState } from "react";

export function TagListEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-cream">{label}</label>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-hairline/10 px-3 py-1 text-xs text-cream">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="text-silver hover:text-red-300"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder="Type and press Enter"
          className="flex-1 rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
