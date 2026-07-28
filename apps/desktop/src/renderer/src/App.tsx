import { HashRouter, Routes, Route } from "react-router-dom";
import { Splash } from "./screens/Splash";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { ProductionOverview } from "./screens/ProductionOverview";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SeriesPlanner } from "./screens/SeriesPlanner";
import { BrandStudio } from "./screens/BrandStudio";
import { CharacterStudio } from "./screens/CharacterStudio";
import { KnowledgeLibrary } from "./screens/KnowledgeLibrary";
import { ScriptStudio } from "./screens/ScriptStudio";
import { StoryboardStudio } from "./screens/StoryboardStudio";
import { PromptWorkshop } from "./screens/PromptWorkshop";
import { AssetLibrary } from "./screens/AssetLibrary";
import { SoundLibrary } from "./screens/SoundLibrary";
import { DocumentImport } from "./screens/DocumentImport";
import { VoiceStudio } from "./screens/VoiceStudio";
import { ScreenCaptureStudio } from "./screens/ScreenCaptureStudio";
import { TimelineEditor } from "./screens/TimelineEditor";
import { CaptionStudio } from "./screens/CaptionStudio";
import { ProvidersScreen } from "./screens/ProvidersScreen";
import { ReviewCenter } from "./screens/ReviewCenter";
import { ExportCenter } from "./screens/ExportCenter";

export function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/production" element={<ProductionOverview />} />
        <Route path="/series" element={<SeriesPlanner />} />
        <Route path="/brands" element={<BrandStudio />} />
        <Route path="/characters" element={<CharacterStudio />} />
        <Route path="/knowledge" element={<KnowledgeLibrary />} />
        <Route path="/scripts" element={<ScriptStudio />} />
        <Route path="/storyboards" element={<StoryboardStudio />} />
        <Route path="/prompts" element={<PromptWorkshop />} />
        <Route path="/assets" element={<AssetLibrary />} />
        <Route path="/sound-library" element={<SoundLibrary />} />
        <Route path="/documents" element={<DocumentImport />} />
        <Route path="/voice" element={<VoiceStudio />} />
        <Route path="/screen-capture" element={<ScreenCaptureStudio />} />
        <Route path="/timeline" element={<TimelineEditor />} />
        <Route path="/captions" element={<CaptionStudio />} />
        <Route path="/providers" element={<ProvidersScreen />} />
        <Route path="/review" element={<ReviewCenter />} />
        <Route path="/export" element={<ExportCenter />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </HashRouter>
  );
}
