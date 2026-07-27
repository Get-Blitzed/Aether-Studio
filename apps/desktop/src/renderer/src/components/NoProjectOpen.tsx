import { useNavigate } from "react-router-dom";
import { NavSidebar } from "./NavSidebar";

export function NoProjectOpen({ what }: { what: string }): JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-cream">Open a production to work with its {what}.</p>
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy"
        >
          Go to Home
        </button>
      </main>
    </div>
  );
}
