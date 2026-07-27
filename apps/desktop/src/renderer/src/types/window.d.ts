import type { AetherBridge } from "../../../preload/index";

declare global {
  interface Window {
    aether: AetherBridge;
  }
}

export {};
