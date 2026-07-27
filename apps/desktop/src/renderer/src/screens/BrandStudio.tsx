import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import type { Brand } from "@aether/shared-types";

function TagListEditor({
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
          <span key={i} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-cream">
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
          className="flex-1 rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
        />
      </div>
    </div>
  );
}

function validateBrand(brand: Brand): string[] {
  const warnings: string[] = [];
  if (brand.logoVariants.length === 0) warnings.push("No logo variant on file.");
  if (brand.colorPalette.length === 0) warnings.push("No brand color palette defined.");
  if (brand.disclaimers.length === 0) warnings.push("No disclaimer text defined.");
  if (brand.accessibilityRequirements.length === 0) warnings.push("No accessibility requirements defined.");
  return warnings;
}

export function BrandStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const isSaving = useAppStore((s) => s.isSaving);
  const [selectedId, setSelectedId] = useState<string | null>(currentManifest?.brands[0]?.id ?? null);

  if (!currentManifest) return <NoProjectOpen what="brands" />;

  const brands = currentManifest.brands;
  const selected = brands.find((b) => b.id === selectedId) ?? brands[0] ?? null;

  async function addBrand() {
    const timestamp = nowIso();
    const brand: Brand = {
      id: generateId("brand"),
      name: "New Brand",
      logoVariants: [],
      colorPalette: [],
      typography: {},
      approvedTerminology: [],
      prohibitedTerminology: [],
      productCapitalizationRules: [],
      legalNotices: [],
      disclaimers: [],
      accessibilityRequirements: [],
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, brands: [...m.brands, brand] }));
    setSelectedId(brand.id);
  }

  async function updateBrand(patch: Partial<Brand>) {
    if (!selected) return;
    await updateAndSave((m) => ({
      ...m,
      brands: m.brands.map((b) => (b.id === selected.id ? { ...b, ...patch, modifiedAt: nowIso() } : b)),
    }));
  }

  async function removeBrand(id: string) {
    await updateAndSave((m) => ({ ...m, brands: m.brands.filter((b) => b.id !== id) }));
    setSelectedId(null);
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Brand Studio</h1>
            <p className="text-sm text-silver">Visual, verbal, and production rules for {currentManifest.title}.</p>
          </div>
          <button
            type="button"
            onClick={addBrand}
            className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
          >
            + New Brand Profile
          </button>
        </header>

        <div className="flex gap-6">
          <aside className="w-56 flex-shrink-0 space-y-1">
            {brands.length === 0 && <p className="text-sm text-silver">No brand profiles yet.</p>}
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  b.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-white/5"
                }`}
              >
                {b.name}
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-charcoal p-4">
                <input
                  value={selected.name}
                  onChange={(e) => updateBrand({ name: e.target.value })}
                  className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeBrand(selected.id)}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>

              {validateBrand(selected).length > 0 && (
                <div className="rounded-md border border-bronze/50 bg-bronze/10 p-4 text-sm text-bronze">
                  <p className="mb-1 font-medium">Validation warnings</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {validateBrand(selected).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-charcoal p-5">
                <label className="mb-1 block text-sm font-medium text-cream">Company / Product Name</label>
                <input
                  value={selected.companyOrProductName ?? ""}
                  onChange={(e) => updateBrand({ companyOrProductName: e.target.value })}
                  className="mb-4 w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
                <label className="mb-1 block text-sm font-medium text-cream">Voice and Tone</label>
                <textarea
                  value={selected.voiceAndTone ?? ""}
                  onChange={(e) => updateBrand({ voiceAndTone: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-charcoal p-5">
                <p className="mb-2 text-sm font-medium text-cream">Color Palette</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {selected.colorPalette.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1">
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-xs text-cream">{c.name}</span>
                      <span className="text-xs text-silver">{c.hex}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateBrand({ colorPalette: selected.colorPalette.filter((_, idx) => idx !== i) })
                        }
                        className="text-xs text-silver hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <ColorAdder
                  onAdd={(name, hex) => updateBrand({ colorPalette: [...selected.colorPalette, { name, hex }] })}
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-charcoal p-5 space-y-4">
                <TagListEditor
                  label="Approved Terminology"
                  values={selected.approvedTerminology}
                  onChange={(v) => updateBrand({ approvedTerminology: v })}
                />
                <TagListEditor
                  label="Prohibited Terminology"
                  values={selected.prohibitedTerminology}
                  onChange={(v) => updateBrand({ prohibitedTerminology: v })}
                />
                <TagListEditor
                  label="Disclaimers"
                  values={selected.disclaimers}
                  onChange={(v) => updateBrand({ disclaimers: v })}
                />
                <TagListEditor
                  label="Accessibility Requirements"
                  values={selected.accessibilityRequirements}
                  onChange={(v) => updateBrand({ accessibilityRequirements: v })}
                />
              </div>
              {isSaving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a brand profile.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function ColorAdder({ onAdd }: { onAdd: (name: string, hex: string) => void }): JSX.Element {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#3E8EF7");
  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-silver">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream focus-visible:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-silver">Color</label>
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-9 w-14 rounded-md border border-white/10 bg-navy"
        />
      </div>
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => {
          onAdd(name.trim(), hex);
          setName("");
        }}
        className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
      >
        Add Color
      </button>
    </div>
  );
}
