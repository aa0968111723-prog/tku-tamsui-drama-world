import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Aperture,
  Layers,
  Sun,
  Download,
  Link2,
  Unplug,
  Sparkles,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  FolderOpen,
  Cpu,
  Send,
  Save,
  Image as ImageIcon,
  Clapperboard,
  Settings2,
  ChevronRight,
} from "lucide-react";
import type {
  AspectRatio,
  LightPreset,
  StageLayer,
  StudioAsset,
  StudioManifest,
  AiosConfig,
  AiosStatus,
  ShotExport,
} from "./types";
import {
  ASPECT_MAP,
  LIGHT_CSS,
  buildDirectorPrompt,
  loadAiosConfig,
  loadProject,
  loadShots,
  probeAios,
  pushToAios,
  saveAiosConfig,
  saveProject,
  saveShots,
} from "./aios";

const LIGHTS: { id: LightPreset; label: string }[] = [
  { id: "soft", label: "柔光" },
  { id: "warm", label: "暖調" },
  { id: "cool", label: "冷調" },
  { id: "cinematic", label: "電影" },
  { id: "highkey", label: "高調" },
  { id: "neon", label: "霓虹" },
];

const ASPECTS: AspectRatio[] = ["16:9", "3:2", "1:1", "4:5", "9:16"];

type Tab = "assets" | "stage" | "aios" | "shots";

export function StudioApp() {
  const [manifest, setManifest] = useState<StudioManifest | null>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [assetFilter, setAssetFilter] = useState<"models" | "guests" | "group" | "campus" | "backdrops">("models");
  const [backdrop, setBackdrop] = useState<StudioAsset | null>(null);
  const [layers, setLayers] = useState<StageLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [light, setLight] = useState<LightPreset>("soft");
  const [aspect, setAspect] = useState<AspectRatio>("3:2");
  const [notes, setNotes] = useState("");
  const [projectName, setProjectName] = useState("安倢 · 虛擬攝影棚");
  const [aios, setAios] = useState<AiosConfig>(() => loadAiosConfig());
  const [aiosStatus, setAiosStatus] = useState<AiosStatus>("offline");
  const [aiosMsg, setAiosMsg] = useState("尚未連線");
  const [director, setDirector] = useState<string[]>([]);
  const [shots, setShots] = useState<ShotExport[]>(() => loadShots());
  const [toast, setToast] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  useEffect(() => {
    fetch("/studio/manifest.json")
      .then((r) => r.json())
      .then((m: StudioManifest) => {
        setManifest(m);
        if (m.backdrops[0]) setBackdrop(m.backdrops[0]!);
        // restore project
        const p = loadProject();
        if (p) {
          setProjectName(p.name);
          setAspect(p.aspect);
          setLight(p.light);
          setNotes(p.notes);
          setLayers(p.layers);
          if (p.backdropId) {
            const b = m.backdrops.find((x) => x.id === p.backdropId);
            if (b) setBackdrop(b);
          }
        }
      })
      .catch(() => setToast("素材清單載入失敗"));
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const assetsForFilter = useMemo(() => {
    if (!manifest) return [];
    return manifest[assetFilter] ?? [];
  }, [manifest, assetFilter]);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const addLayer = (asset: StudioAsset) => {
    if (assetFilter === "backdrops") {
      setBackdrop(asset);
      flash(`背景：${asset.label}`);
      return;
    }
    const layer: StageLayer = {
      id: `L${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      assetId: asset.id,
      src: asset.src,
      label: asset.label,
      x: 50 + (Math.random() * 8 - 4),
      y: 58 + (Math.random() * 6 - 3),
      scale: asset.w > asset.h ? 0.55 : 0.72,
      rotate: 0,
      z: layers.length + 1,
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(layer.id);
    setTab("stage");
    flash(`已加入：${asset.label}`);
  };

  const updateLayer = (id: string, patch: Partial<StageLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const persistProject = useCallback(() => {
    saveProject({
      name: projectName,
      updatedAt: new Date().toISOString(),
      aspect,
      light,
      backdropId: backdrop?.id ?? null,
      layers,
      notes,
    });
    flash("專案已儲存");
  }, [projectName, aspect, light, backdrop, layers, notes, flash]);

  const connectAios = async () => {
    setAiosStatus("connecting");
    setAiosMsg("連線中…");
    saveAiosConfig(aios);
    const res = await probeAios(aios);
    setAiosStatus(res.status);
    setAiosMsg(res.message);
    flash(res.message);
  };

  const syncAios = async () => {
    saveAiosConfig(aios);
    persistProject();
    const payload = {
      name: projectName,
      aspect,
      light,
      backdrop: backdrop ? { id: backdrop.id, label: backdrop.label, src: backdrop.src } : null,
      layers: layers.map((l) => ({
        id: l.id,
        label: l.label,
        src: l.src,
        x: l.x,
        y: l.y,
        scale: l.scale,
        rotate: l.rotate,
      })),
      notes,
      directorTips: director,
      shotCount: shots.length,
    };
    const res = await pushToAios(aios, { type: "studio.sync", project: payload });
    flash(res.message);
    if (res.ok && aiosStatus !== "connected") {
      // still mark bridge ready
      setAiosMsg(res.message);
    }
  };

  const runDirector = () => {
    const labels = layers.map((l) => l.label);
    const prompt = buildDirectorPrompt({
      light,
      aspect,
      subjectLabels: labels,
      backdropLabel: backdrop?.label ?? "無",
    });
    // Local intelligent tips (works without AIOS); if connected, tips still useful offline
    const tips = generateLocalDirector(light, aspect, labels, backdrop?.label ?? "棚拍白背景");
    setDirector(tips);
    setTab("aios");
    flash("AI 導演已產出建議");
    // also queue to AIOS outbox
    void pushToAios(aios, {
      type: "studio.director",
      prompt,
      tips,
    });
  };

  const capture = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      // Render via canvas composite for reliable export
      const ratio = ASPECT_MAP[aspect];
      const W = 1280;
      const H = Math.round(W / ratio);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      // backdrop
      if (backdrop) {
        const img = await loadImage(backdrop.src);
        drawCover(ctx, img, W, H);
      } else {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, W, H);
      }
      // layers sorted by z
      const sorted = [...layers].sort((a, b) => a.z - b.z);
      for (const layer of sorted) {
        const img = await loadImage(layer.src);
        const maxH = H * 0.85 * layer.scale;
        const scale = maxH / img.naturalHeight;
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const cx = (layer.x / 100) * W;
        const cy = (layer.y / 100) * H;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((layer.rotate * Math.PI) / 180);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
      // light overlay approx
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.2, 10, W * 0.5, H * 0.4, H * 0.8);
      if (light === "warm") {
        grad.addColorStop(0, "rgba(255,180,90,0.18)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
      } else if (light === "cool") {
        grad.addColorStop(0, "rgba(120,180,255,0.16)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
      } else if (light === "cinematic") {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, W * 0.12, H);
        ctx.fillRect(W * 0.88, 0, W * 0.12, H);
      } else {
        grad.addColorStop(0, "rgba(255,255,255,0.12)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const shot: ShotExport = {
        id: `shot_${Date.now()}`,
        title: `${projectName} · ${new Date().toLocaleString("zh-TW")}`,
        createdAt: new Date().toISOString(),
        aspect,
        light,
        backdropId: backdrop?.id ?? null,
        layers: [...layers],
        notes,
        dataUrl,
      };
      const next = [shot, ...shots].slice(0, 40);
      setShots(next);
      saveShots(next);
      // download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `studio-${Date.now()}.jpg`;
      a.click();
      flash("已拍攝並下載");
      setTab("shots");
      if (aios.autoSync) void syncAios();
    } catch (e) {
      flash(e instanceof Error ? e.message : "拍攝失敗");
    }
  };

  // drag layers
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const stage = stageRef.current;
      if (!d || !stage) return;
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      updateLayer(d.id, {
        x: Math.max(5, Math.min(95, x - d.ox)),
        y: Math.max(8, Math.min(95, y - d.oy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const statusColor =
    aiosStatus === "connected"
      ? "text-primary"
      : aiosStatus === "connecting"
        ? "text-accent"
        : aiosStatus === "error"
          ? "text-danger"
          : "text-muted";

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Aperture className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight sm:text-base">{projectName}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Cpu className={`h-3 w-3 ${statusColor}`} />
              <span className={statusColor}>AIOS · {aiosMsg}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={persistProject} className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs sm:flex">
            <Save className="h-3.5 w-3.5" />
            存檔
          </button>
          <button type="button" onClick={runDirector} className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs text-primary sm:px-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI 導演</span>
          </button>
          <button type="button" onClick={capture} className="btn-primary flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs sm:px-4">
            <Camera className="h-3.5 w-3.5" />
            拍攝
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left rail — desktop */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface/60 md:flex">
          <nav className="flex gap-1 border-b border-border p-2">
            {(
              [
                ["assets", "素材", FolderOpen],
                ["stage", "舞台", Layers],
                ["aios", "AIOS", Cpu],
                ["shots", "成品", Clapperboard],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] ${
                  tab === id ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "assets" && manifest && (
              <AssetsPanel
                filter={assetFilter}
                setFilter={setAssetFilter}
                assets={assetsForFilter}
                onPick={addLayer}
                counts={{
                  models: manifest.models.length,
                  guests: manifest.guests.length,
                  group: manifest.group.length,
                  campus: manifest.campus.length,
                  backdrops: manifest.backdrops.length,
                }}
              />
            )}
            {tab === "stage" && (
              <StagePanel
                light={light}
                setLight={setLight}
                aspect={aspect}
                setAspect={setAspect}
                layers={layers}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                selected={selected}
                updateLayer={updateLayer}
                removeLayer={removeLayer}
                onClear={() => {
                  setLayers([]);
                  setSelectedId(null);
                }}
              />
            )}
            {tab === "aios" && (
              <AiosPanel
                aios={aios}
                setAios={setAios}
                status={aiosStatus}
                message={aiosMsg}
                projectName={projectName}
                setProjectName={setProjectName}
                notes={notes}
                setNotes={setNotes}
                director={director}
                onConnect={connectAios}
                onSync={syncAios}
                onDirector={runDirector}
              />
            )}
            {tab === "shots" && <ShotsPanel shots={shots} onClear={() => { setShots([]); saveShots([]); }} />}
          </div>
        </aside>

        {/* center stage */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-[#070a0f]">
          <div className="flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
            <div
              className="relative max-h-full max-w-full shadow-2xl"
              style={{
                aspectRatio: String(ASPECT_MAP[aspect]),
                width: "min(100%, 920px)",
              }}
            >
              <div
                ref={stageRef}
                className="relative h-full w-full overflow-hidden rounded-lg border border-border/80 bg-surface-2"
              >
                {backdrop ? (
                  <img src={backdrop.src} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 bg-surface-2" />
                )}
                <div className="pointer-events-none absolute inset-0" style={{ background: LIGHT_CSS[light] }} />
                {[...layers]
                  .sort((a, b) => a.z - b.z)
                  .map((layer) => (
                    <div
                      key={layer.id}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing ${
                        selectedId === layer.id ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""
                      }`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        zIndex: layer.z + 5,
                        transform: `translate(-50%, -50%) rotate(${layer.rotate}deg) scale(${layer.scale})`,
                        width: "min(42%, 280px)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setSelectedId(layer.id);
                        const stage = stageRef.current!.getBoundingClientRect();
                        const cx = (layer.x / 100) * stage.width;
                        const cy = (layer.y / 100) * stage.height;
                        dragRef.current = {
                          id: layer.id,
                          ox: ((e.clientX - stage.left - cx) / stage.width) * 100,
                          oy: ((e.clientY - stage.top - cy) / stage.height) * 100,
                        };
                      }}
                    >
                      <img
                        src={layer.src}
                        alt={layer.label}
                        className="h-auto w-full select-none rounded-sm shadow-lg"
                        draggable={false}
                      />
                    </div>
                  ))}
                {/* frame guides */}
                <div className="pointer-events-none absolute inset-0 border border-white/10" />
                <div className="pointer-events-none absolute inset-0 opacity-20">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute top-1/3 left-0 h-px w-full bg-white/40" />
                  <div className="absolute top-2/3 left-0 h-px w-full bg-white/40" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted sm:text-xs">
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {backdrop?.label ?? "無背景"} · {layers.length} 層
                </span>
                <span>
                  {aspect} · {LIGHTS.find((l) => l.id === light)?.label}
                </span>
              </div>
            </div>
          </div>

          {/* mobile bottom controls */}
          <div className="border-t border-border bg-surface/95 p-2 md:hidden">
            <div className="mb-2 flex gap-1">
              {(
                [
                  ["assets", "素材"],
                  ["stage", "舞台"],
                  ["aios", "AIOS"],
                  ["shots", "成品"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-lg py-2 text-xs ${tab === id ? "bg-primary/15 text-primary" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-bg/50 p-2">
              {tab === "assets" && manifest && (
                <AssetsPanel
                  filter={assetFilter}
                  setFilter={setAssetFilter}
                  assets={assetsForFilter}
                  onPick={addLayer}
                  counts={{
                    models: manifest.models.length,
                    guests: manifest.guests.length,
                    group: manifest.group.length,
                    campus: manifest.campus.length,
                    backdrops: manifest.backdrops.length,
                  }}
                  compact
                />
              )}
              {tab === "stage" && (
                <StagePanel
                  light={light}
                  setLight={setLight}
                  aspect={aspect}
                  setAspect={setAspect}
                  layers={layers}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  selected={selected}
                  updateLayer={updateLayer}
                  removeLayer={removeLayer}
                  onClear={() => {
                    setLayers([]);
                    setSelectedId(null);
                  }}
                  compact
                />
              )}
              {tab === "aios" && (
                <AiosPanel
                  aios={aios}
                  setAios={setAios}
                  status={aiosStatus}
                  message={aiosMsg}
                  projectName={projectName}
                  setProjectName={setProjectName}
                  notes={notes}
                  setNotes={setNotes}
                  director={director}
                  onConnect={connectAios}
                  onSync={syncAios}
                  onDirector={runDirector}
                  compact
                />
              )}
              {tab === "shots" && <ShotsPanel shots={shots} onClear={() => { setShots([]); saveShots([]); }} compact />}
            </div>
          </div>
        </main>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
          <div className="panel-glass rounded-full px-4 py-2 text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}

function AssetsPanel({
  filter,
  setFilter,
  assets,
  onPick,
  counts,
  compact,
}: {
  filter: "models" | "guests" | "group" | "campus" | "backdrops";
  setFilter: (f: typeof filter) => void;
  assets: StudioAsset[];
  onPick: (a: StudioAsset) => void;
  counts: Record<string, number>;
  compact?: boolean;
}) {
  const tabs = [
    ["models", "安倢", counts.models],
    ["guests", "哲維", counts.guests],
    ["group", "群組", counts.group],
    ["campus", "校園", counts.campus],
    ["backdrops", "背景", counts.backdrops],
  ] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-2.5 py-1 text-[11px] ${
              filter === id ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted"
            }`}
          >
            {label} {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted">點選加入舞台；背景會直接替換棚景。</p>
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2"}`}>
        {assets.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className="group overflow-hidden rounded-xl border border-border bg-surface-2 text-left transition hover:border-primary/40"
          >
            <div className="aspect-[3/4] overflow-hidden bg-bg">
              <img src={a.src} alt={a.label} className="h-full w-full object-cover transition group-hover:scale-105" />
            </div>
            <div className="truncate px-2 py-1.5 text-[10px] text-muted">{a.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StagePanel({
  light,
  setLight,
  aspect,
  setAspect,
  layers,
  selectedId,
  setSelectedId,
  selected,
  updateLayer,
  removeLayer,
  onClear,
  compact,
}: {
  light: LightPreset;
  setLight: (l: LightPreset) => void;
  aspect: AspectRatio;
  setAspect: (a: AspectRatio) => void;
  layers: StageLayer[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selected: StageLayer | null;
  updateLayer: (id: string, p: Partial<StageLayer>) => void;
  removeLayer: (id: string) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <Sun className="h-3.5 w-3.5 text-accent" />
          燈光
        </div>
        <div className="flex flex-wrap gap-1">
          {LIGHTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLight(l.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                light === l.id ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-muted">畫幅</div>
        <div className="flex flex-wrap gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                aspect === a ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            圖層 {layers.length}
          </span>
          <button type="button" onClick={onClear} className="text-danger/80 hover:text-danger">
            清空
          </button>
        </div>
        <ul className="space-y-1">
          {layers.length === 0 && <li className="text-[11px] text-muted">從素材庫加入主體</li>}
          {[...layers]
            .sort((a, b) => b.z - a.z)
            .map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                    selectedId === l.id ? "bg-primary/15 text-primary" : "bg-surface-2 text-fg"
                  }`}
                >
                  <img src={l.src} alt="" className="h-8 w-8 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </button>
              </li>
            ))}
        </ul>
      </div>
      {selected && (
        <div className="space-y-2 rounded-xl border border-border bg-surface-2/80 p-3">
          <div className="text-xs font-medium">{selected.label}</div>
          <label className="block text-[10px] text-muted">
            縮放 {selected.scale.toFixed(2)}
            <input
              type="range"
              min={0.25}
              max={1.4}
              step={0.01}
              value={selected.scale}
              onChange={(e) => updateLayer(selected.id, { scale: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-[10px] text-muted">
            旋轉 {selected.rotate}°
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={selected.rotate}
              onChange={(e) => updateLayer(selected.id, { rotate: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-bg py-2 text-[11px]"
              onClick={() => updateLayer(selected.id, { scale: Math.min(1.4, selected.scale + 0.05) })}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-bg py-2 text-[11px]"
              onClick={() => updateLayer(selected.id, { scale: Math.max(0.25, selected.scale - 0.05) })}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-bg py-2 text-[11px]"
              onClick={() => updateLayer(selected.id, { rotate: 0, scale: 0.7, x: 50, y: 58 })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-danger/15 py-2 text-[11px] text-danger"
              onClick={() => removeLayer(selected.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {!compact && (
            <p className="flex items-center gap-1 text-[10px] text-muted">
              <Move className="h-3 w-3" />
              在舞台上拖曳移動主體
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AiosPanel({
  aios,
  setAios,
  status,
  message,
  projectName,
  setProjectName,
  notes,
  setNotes,
  director,
  onConnect,
  onSync,
  onDirector,
  compact,
}: {
  aios: AiosConfig;
  setAios: (c: AiosConfig) => void;
  status: AiosStatus;
  message: string;
  projectName: string;
  setProjectName: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
  director: string[];
  onConnect: () => void;
  onSync: () => void;
  onDirector: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
          <Cpu className="h-4 w-4" />
          AIOS 橋接
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          連到你的 AI Agent OS（本機 Kernel / 自架端點）。離線時會寫入本機橋接佇列，之後可再同步。
        </p>
        <div className={`mt-2 text-[11px] ${status === "connected" ? "text-primary" : status === "error" ? "text-danger" : "text-muted"}`}>
          {status === "connected" ? <Link2 className="mr-1 inline h-3 w-3" /> : <Unplug className="mr-1 inline h-3 w-3" />}
          {message}
        </div>
      </div>

      <label className="block text-[11px] text-muted">
        專案名稱
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none focus:border-primary/50"
        />
      </label>
      <label className="block text-[11px] text-muted">
        AIOS 端點 URL
        <input
          value={aios.endpoint}
          onChange={(e) => setAios({ ...aios, endpoint: e.target.value })}
          placeholder="http://127.0.0.1:8000"
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none focus:border-primary/50"
        />
      </label>
      <label className="block text-[11px] text-muted">
        API Key（選填）
        <input
          type="password"
          value={aios.apiKey}
          onChange={(e) => setAios({ ...aios, apiKey: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none focus:border-primary/50"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-muted">
          Agent
          <input
            value={aios.agentName}
            onChange={(e) => setAios({ ...aios, agentName: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none"
          />
        </label>
        <label className="block text-[11px] text-muted">
          Project ID
          <input
            value={aios.projectId}
            onChange={(e) => setAios({ ...aios, projectId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted">
        <input
          type="checkbox"
          checked={aios.autoSync}
          onChange={(e) => setAios({ ...aios, autoSync: e.target.checked })}
        />
        拍攝後自動同步 AIOS
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onConnect} className="btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs">
          <Link2 className="h-3.5 w-3.5" />
          連線
        </button>
        <button type="button" onClick={onSync} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 py-2.5 text-xs">
          <Send className="h-3.5 w-3.5" />
          同步
        </button>
      </div>
      <label className="block text-[11px] text-muted">
        拍攝筆記
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="情緒、用途、交付對象…"
          className="mt-1 w-full resize-none rounded-lg border border-border bg-bg px-2.5 py-2 text-xs text-fg outline-none"
        />
      </label>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI 導演建議
          </span>
          <button type="button" onClick={onDirector} className="text-[11px] text-primary">
            重新產生
          </button>
        </div>
        {director.length === 0 ? (
          <p className="text-[11px] text-muted">按「AI 導演」取得構圖建議</p>
        ) : (
          <ul className="space-y-1.5">
            {director.map((t, i) => (
              <li key={i} className="rounded-lg border border-border/60 bg-bg/60 px-2.5 py-2 text-[11px] leading-relaxed text-fg">
                {i + 1}. {t}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!compact && (
        <div className="rounded-lg border border-border/50 bg-bg/40 p-2 text-[10px] leading-relaxed text-muted">
          <Settings2 className="mb-1 inline h-3 w-3" /> 支援常見路徑：
          <code className="mx-0.5 text-primary/80">/health</code>、
          <code className="mx-0.5 text-primary/80">/api/agents/…/run</code>、
          <code className="mx-0.5 text-primary/80">/api/studio/sync</code>
        </div>
      )}
    </div>
  );
}

function ShotsPanel({
  shots,
  onClear,
  compact,
}: {
  shots: ShotExport[];
  onClear: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>已拍攝 {shots.length}</span>
        {shots.length > 0 && (
          <button type="button" onClick={onClear} className="text-danger/80">
            清除
          </button>
        )}
      </div>
      {shots.length === 0 && <p className="text-[11px] text-muted">按上方「拍攝」輸出成品</p>}
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1"}`}>
        {shots.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-surface-2">
            {s.dataUrl && <img src={s.dataUrl} alt={s.title} className="aspect-video w-full object-cover" />}
            <div className="space-y-1 p-2">
              <div className="truncate text-[11px] font-medium">{s.title}</div>
              <div className="text-[10px] text-muted">
                {s.aspect} · {s.light}
              </div>
              {s.dataUrl && (
                <a href={s.dataUrl} download={`${s.id}.jpg`} className="inline-flex items-center gap-1 text-[11px] text-primary">
                  <Download className="h-3 w-3" />
                  下載
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片載入失敗"));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = W / H;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > cr) {
    dh = H;
    dw = H * ir;
    dx = (W - dw) / 2;
    dy = 0;
  } else {
    dw = W;
    dh = W / ir;
    dx = 0;
    dy = (H - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function generateLocalDirector(
  light: LightPreset,
  aspect: AspectRatio,
  subjects: string[],
  backdrop: string,
): string[] {
  const sub = subjects[0] ?? "主體";
  const tips: string[] = [];
  if (aspect === "9:16" || aspect === "4:5") {
    tips.push(`直式 ${aspect}：把「${sub}」放在下半三分線，頭頂留氣口，適合限動／社群封面。`);
  } else if (aspect === "1:1") {
    tips.push(`方形構圖：主體置中略偏左，背景「${backdrop}」不要太滿，留負空間。`);
  } else {
    tips.push(`橫式 ${aspect}：主體偏右三分，視線朝畫面開放側，延伸故事感。`);
  }
  const lightTip: Record<LightPreset, string> = {
    soft: "柔光適合生活感特寫：略提高曝光感，減少硬陰影。",
    warm: "暖調黃金時刻：加強膚色，可把主體放在光方向側逆光邊緣。",
    cool: "冷調理性棚感：壓低飽和、提高對比，適合產品／形象混搭。",
    cinematic: "電影光：左右暗角已就緒，讓主體落在亮區，可微旋轉 2–3°。",
    highkey: "高調通透：避免深色衣物貼邊，背景保持乾淨。",
    neon: "霓虹：讓主體輪廓吃到綠／粉反射，表情可以更戲劇。",
  };
  tips.push(lightTip[light]);
  if (subjects.length >= 2) {
    tips.push(`雙人／多層：前後層差 8–12% 高度，主體較大在前，避免頭部重疊。`);
  } else {
    tips.push(`單人：縮放約 0.65–0.8，腳位靠近下緣 15%，手勢自然不擋臉。`);
  }
  return tips;
}
