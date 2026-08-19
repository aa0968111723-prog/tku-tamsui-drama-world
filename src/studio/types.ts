export type AssetRole = "model" | "guest" | "prop" | "location" | "backdrop";

export type StudioAsset = {
  id: string;
  src: string;
  w: number;
  h: number;
  label: string;
  role?: AssetRole;
};

export type StudioManifest = {
  models: StudioAsset[];
  guests: StudioAsset[];
  group: StudioAsset[];
  campus: StudioAsset[];
  backdrops: StudioAsset[];
};

export type StageLayer = {
  id: string;
  assetId: string;
  src: string;
  label: string;
  x: number; // 0-100 % of stage
  y: number;
  scale: number;
  rotate: number;
  z: number;
};

export type LightPreset = "soft" | "warm" | "cool" | "cinematic" | "highkey" | "neon";
export type AspectRatio = "16:9" | "3:2" | "1:1" | "9:16" | "4:5";

export type AiosConfig = {
  endpoint: string;
  apiKey: string;
  projectId: string;
  agentName: string;
  autoSync: boolean;
};

export type AiosStatus = "offline" | "connecting" | "connected" | "error";

export type ShotExport = {
  id: string;
  title: string;
  createdAt: string;
  aspect: AspectRatio;
  light: LightPreset;
  backdropId: string | null;
  layers: StageLayer[];
  notes: string;
  dataUrl?: string;
};
