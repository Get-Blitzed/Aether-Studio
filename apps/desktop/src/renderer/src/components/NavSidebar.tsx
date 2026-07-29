import { useNavigate, useLocation } from "react-router-dom";
import { Wordmark } from "./Wordmark";

interface NavItemDef {
  label: string;
  path?: string;
  disabledReason?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { label: "Home", path: "/home" },
  { label: "Productions", path: "/home" },
  { label: "Series", path: "/series" },
  { label: "Knowledge", path: "/knowledge" },
  { label: "Import Document", path: "/documents" },
  { label: "Scripts", path: "/scripts" },
  { label: "Storyboards", path: "/storyboards" },
  { label: "Prompts", path: "/prompts" },
  { label: "Timeline", path: "/timeline" },
  { label: "Characters", path: "/characters" },
  { label: "Brands", path: "/brands" },
  { label: "Assets", path: "/assets" },
  { label: "Sound Library", path: "/sound-library" },
  { label: "Music Library", path: "/music-library" },
  { label: "Icon Library", path: "/icon-library" },
  { label: "Voice", path: "/voice" },
  { label: "Animation", disabledReason: "Animation & Shot Lab is not yet scheduled in the roadmap." },
  { label: "Screen Capture", path: "/screen-capture" },
  { label: "Audio", path: "/timeline" },
  { label: "Captions", path: "/captions" },
  { label: "Review", path: "/review" },
  { label: "Export", path: "/export" },
  { label: "Templates", disabledReason: "Template System arrives in Phase 8." },
  { label: "Providers", path: "/providers" },
  { label: "Learning Center", disabledReason: "Learning Center arrives in Phase 8." },
  { label: "Settings", path: "/settings" },
];

export function NavSidebar(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="flex w-56 flex-shrink-0 flex-col gap-1 border-r border-white/10 bg-charcoal p-3" aria-label="Primary">
      <button
        type="button"
        onClick={() => navigate("/home")}
        className="mb-3 flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-white/5"
        aria-label="Aether Studio Suite home"
      >
        <Wordmark size="sm" compact />
      </button>
      {NAV_ITEMS.map((item) => {
        const isActive = item.path && location.pathname === item.path;
        if (!item.path) {
          return (
            <div key={item.label} className="group relative">
              <button
                type="button"
                disabled
                title={item.disabledReason}
                aria-disabled="true"
                className="w-full cursor-not-allowed rounded-full px-3 py-2 text-left text-sm text-silver/40"
              >
                {item.label}
              </button>
            </div>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.path!)}
            className={`flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors ${
              isActive
                ? "bg-gradient-to-r from-electric-blue/25 to-aurora-pink/15 text-cream"
                : "text-silver hover:bg-white/5 hover:text-cream"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? "bg-aurora-pink" : "bg-transparent"}`}
              aria-hidden="true"
            />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
