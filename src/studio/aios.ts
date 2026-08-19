import type { AiosConfig, AiosStatus, ShotExport, StageLayer, LightPreset, AspectRatio } from "./types";

const CFG_KEY = "aios-studio-config-v1";
const SHOTS_KEY = "aios-studio-shots-v1";
const PROJECT_KEY = "aios-studio-project-v1";

export const DEFAULT_AIOS: AiosConfig = {
  endpoint: "http://127.0.0.1:8000",
  apiKey: "",
  projectId: "virtual-studio",
  agentName: "PhotoDirector",
  autoSync: false,
};

export function loadAiosConfig(): AiosConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { ...DEFAULT_AIOS };
    return { ...DEFAULT_AIOS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AIOS };
  }
}

export function saveAiosConfig(cfg: AiosConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export function loadShots(): ShotExport[] {
  try {
    return JSON.parse(localStorage.getItem(SHOTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveShots(shots: ShotExport[]) {
  localStorage.setItem(SHOTS_KEY, JSON.stringify(shots.slice(0, 40)));
}

export type ProjectBridge = {
  name: string;
  updatedAt: string;
  aspect: AspectRatio;
  light: LightPreset;
  backdropId: string | null;
  layers: StageLayer[];
  notes: string;
};

export function loadProject(): ProjectBridge | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProject(p: ProjectBridge) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(p));
}

/** Probe AIOS kernel / agent host. Tries several common health paths. */
export async function probeAios(
  cfg: AiosConfig,
  timeoutMs = 3500,
): Promise<{ status: AiosStatus; message: string; detail?: unknown }> {
  if (!cfg.endpoint?.trim()) {
    return { status: "offline", message: "尚未設定 AIOS 端點" };
  }
  const base = cfg.endpoint.replace(/\/$/, "");
  const paths = ["/health", "/api/health", "/v1/health", "/status", "/"];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (const path of paths) {
      try {
        const res = await fetch(`${base}${path}`, {
          method: "GET",
          signal: controller.signal,
          headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : undefined,
        });
        if (res.ok || res.status === 401 || res.status === 403) {
          clearTimeout(timer);
          if (res.status === 401 || res.status === 403) {
            return {
              status: "connected",
              message: `已連上 AIOS（需金鑰）${path} · HTTP ${res.status}`,
            };
          }
          let detail: unknown = null;
          try {
            detail = await res.json();
          } catch {
            detail = await res.text();
          }
          return {
            status: "connected",
            message: `已連線 AIOS · ${path}`,
            detail,
          };
        }
      } catch {
        /* try next path */
      }
    }
    clearTimeout(timer);
    return {
      status: "error",
      message: "無法連線：請確認 AIOS 已啟動，並允許跨網域（CORS）",
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      status: "error",
      message: e instanceof Error ? e.message : "連線失敗",
    };
  }
}

/** Push studio project payload to AIOS agent endpoint. */
export async function pushToAios(
  cfg: AiosConfig,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> {
  const base = cfg.endpoint.replace(/\/$/, "");
  const candidates = [
    `/api/agents/${encodeURIComponent(cfg.agentName)}/run`,
    `/agents/${encodeURIComponent(cfg.agentName)}`,
    `/api/v1/agents/run`,
    `/v1/chat/completions`,
    `/api/studio/sync`,
  ];
  const body = {
    project_id: cfg.projectId,
    agent: cfg.agentName,
    source: "grok-virtual-studio",
    ...payload,
  };

  for (const path of candidates) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 201 || res.status === 202) {
        return { ok: true, message: `已推送至 AIOS · ${path}` };
      }
    } catch {
      /* next */
    }
  }

  // Local bridge always succeeds — AIOS offline mode
  const bridge = {
    ...body,
    bridgedAt: new Date().toISOString(),
    mode: "local-bridge",
  };
  localStorage.setItem("aios-studio-bridge-outbox", JSON.stringify(bridge));
  return {
    ok: true,
    message: "AIOS 離線：已寫入本機橋接佇列，連線後可再同步",
  };
}

export function buildDirectorPrompt(ctx: {
  light: LightPreset;
  aspect: AspectRatio;
  subjectLabels: string[];
  backdropLabel: string;
}): string {
  const subjects = ctx.subjectLabels.join("、") || "尚未放置主體";
  return [
    `你是虛擬攝影棚 AI 導演（AIOS · ${"PhotoDirector"}）。`,
    `畫幅 ${ctx.aspect}，燈光 ${ctx.light}，背景「${ctx.backdropLabel}」。`,
    `目前主體：${subjects}。`,
    `請給 3 條可執行的構圖／表情／光線建議，繁體中文，簡短有力。`,
  ].join(" ");
}

export const LIGHT_CSS: Record<LightPreset, string> = {
  soft: "linear-gradient(180deg, rgb(255 255 255 / 0.08), transparent 40%), radial-gradient(ellipse at 50% 20%, rgb(255 255 255 / 0.18), transparent 55%)",
  warm: "linear-gradient(135deg, rgb(255 180 90 / 0.22), transparent 50%), radial-gradient(ellipse at 30% 20%, rgb(255 200 120 / 0.2), transparent 50%)",
  cool: "linear-gradient(135deg, rgb(120 180 255 / 0.2), transparent 50%), radial-gradient(ellipse at 70% 15%, rgb(160 210 255 / 0.18), transparent 50%)",
  cinematic: "linear-gradient(90deg, rgb(0 0 0 / 0.45), transparent 30%, transparent 70%, rgb(0 0 0 / 0.45)), radial-gradient(ellipse at 40% 30%, rgb(255 160 80 / 0.15), transparent 45%)",
  highkey: "linear-gradient(180deg, rgb(255 255 255 / 0.35), rgb(255 255 255 / 0.12))",
  neon: "radial-gradient(ellipse at 25% 40%, rgb(94 228 168 / 0.25), transparent 40%), radial-gradient(ellipse at 75% 30%, rgb(240 160 192 / 0.22), transparent 40%)",
};

export const ASPECT_MAP: Record<AspectRatio, number> = {
  "16:9": 16 / 9,
  "3:2": 3 / 2,
  "1:1": 1,
  "9:16": 9 / 16,
  "4:5": 4 / 5,
};
