import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Users,
  ScrollText,
  Clapperboard,
  Github,
  Play,
  Plus,
  Trash2,
  Save,
  Download,
  Sparkles,
  ChevronRight,
  BookOpen,
  Globe2,
  Film,
  Pencil,
  Copy,
  ExternalLink,
  Layers,
} from "lucide-react";
import {
  buildWorldFiles,
  downloadText,
  downloadWorldPack,
  loadGithubTarget,
  saveGithubTarget,
  type GithubTarget,
} from "./githubBridge";

type Beat = { type: "action" | "dialogue" | "note"; speaker?: string; text: string };
type Scene = {
  id: string;
  title: string;
  locationId: string;
  characters: string[];
  beats: Beat[];
};
type Location = {
  id: string;
  name: string;
  en?: string;
  area: string;
  mood: string;
  desc: string;
  backdrop: string;
  tags?: string[];
};
type Character = {
  id: string;
  name: string;
  role: string;
  year?: string;
  trait: string;
  goal: string;
  avatar: string;
  color: string;
};
type World = {
  id: string;
  title: string;
  subtitle?: string;
  setting: Record<string, string>;
  locations: Location[];
  characters: Character[];
  episode: { id: string; title: string; logline: string; scenes: Scene[] };
};

type Tab = "world" | "locations" | "characters" | "script" | "stage" | "github";

const SAVE_KEY = "tku-drama-world-v1";

export function WorldApp() {
  const [world, setWorld] = useState<World | null>(null);
  const [tab, setTab] = useState<Tab>("world");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [locId, setLocId] = useState<string | null>(null);
  const [charId, setCharId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [gh, setGh] = useState<GithubTarget>(() => loadGithubTarget());
  const [beatDraft, setBeatDraft] = useState("");
  const [beatType, setBeatType] = useState<Beat["type"]>("dialogue");
  const [beatSpeaker, setBeatSpeaker] = useState("anjie");

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const w = JSON.parse(saved) as World;
        setWorld(w);
        setSceneId(w.episode.scenes[0]?.id ?? null);
        setLocId(w.locations[0]?.id ?? null);
        setCharId(w.characters[0]?.id ?? null);
        return;
      } catch { /* fallthrough */ }
    }
    fetch("/world/seed.json")
      .then((r) => r.json())
      .then((w: World) => {
        setWorld(w);
        setSceneId(w.episode.scenes[0]?.id ?? null);
        setLocId(w.locations[0]?.id ?? null);
        setCharId(w.characters[0]?.id ?? null);
      });
  }, []);

  const scene = world?.episode.scenes.find((s) => s.id === sceneId) ?? null;
  const location = world?.locations.find((l) => l.id === (scene?.locationId ?? locId)) ?? null;
  const selectedLoc = world?.locations.find((l) => l.id === locId) ?? null;
  const selectedChar = world?.characters.find((c) => c.id === charId) ?? null;

  const persist = () => {
    if (!world) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(world));
    flash("世界已儲存到本機");
  };

  const updateScene = (id: string, patch: Partial<Scene>) => {
    if (!world) return;
    setWorld({
      ...world,
      episode: {
        ...world.episode,
        scenes: world.episode.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
    });
  };

  const addBeat = () => {
    if (!world || !scene || !beatDraft.trim()) return;
    const beat: Beat = {
      type: beatType,
      text: beatDraft.trim(),
      ...(beatType === "dialogue" ? { speaker: beatSpeaker } : {}),
    };
    updateScene(scene.id, { beats: [...scene.beats, beat] });
    setBeatDraft("");
    flash("已加入劇本節拍");
  };

  const removeBeat = (idx: number) => {
    if (!scene) return;
    updateScene(scene.id, { beats: scene.beats.filter((_, i) => i !== idx) });
  };

  const addScene = () => {
    if (!world) return;
    const id = `s${Date.now()}`;
    const sc: Scene = {
      id,
      title: `新場次 · ${world.locations[0]?.name ?? "未命名"}`,
      locationId: world.locations[0]?.id ?? "palace",
      characters: ["anjie"],
      beats: [{ type: "action", text: "（描述畫面）" }],
    };
    setWorld({
      ...world,
      episode: { ...world.episode, scenes: [...world.episode.scenes, sc] },
    });
    setSceneId(id);
    setTab("script");
  };

  const exportGithubPack = () => {
    if (!world) return;
    const files = buildWorldFiles(world, world.title);
    downloadWorldPack(files, world.id);
    // also expose copy-ready commit message
    flash("已匯出 world pack + SCRIPT.md（可丟進 GitHub repo）");
  };

  const copyCommitMessage = async () => {
    const msg = `feat(world): update ${world?.episode.title ?? "episode"} — Tamsui/TKU drama world`;
    try {
      await navigator.clipboard.writeText(msg);
      flash("Commit 訊息已複製");
    } catch {
      flash(msg);
    }
  };

  const charName = (id: string) => world?.characters.find((c) => c.id === id)?.name ?? id;
  const locName = (id: string) => world?.locations.find((l) => l.id === id)?.name ?? id;

  if (!world) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg text-muted">
        載入淡江·淡水世界…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Globe2 }[] = [
    { id: "world", label: "世界", icon: Globe2 },
    { id: "locations", label: "地點", icon: MapPin },
    { id: "characters", label: "角色", icon: Users },
    { id: "script", label: "劇本", icon: ScrollText },
    { id: "stage", label: "舞台", icon: Clapperboard },
    { id: "github", label: "GitHub", icon: Github },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Film className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">{world.title}</h1>
              <p className="truncate text-[11px] text-muted">{world.subtitle} · World as Code</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="/play"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs text-fg sm:flex"
          >
            <Play className="h-3.5 w-3.5 text-primary" />
            進入世界
          </a>
          <button type="button" onClick={persist} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-xs sm:px-3">
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">存檔</span>
          </button>
          <button type="button" onClick={exportGithubPack} className="btn-primary flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs sm:px-3">
            <Download className="h-3.5 w-3.5" />
            匯出
          </button>
        </div>
      </header>

      {/* mobile tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface/50 px-2 py-1.5 md:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] ${
              tab === t.id ? "bg-primary/20 text-primary" : "text-muted"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-surface/50 md:flex">
          <nav className="flex flex-col gap-0.5 p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                  tab === t.id ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-border p-3 text-[10px] leading-relaxed text-muted">
            地點 {world.locations.length} · 角色 {world.characters.length} · 場次{" "}
            {world.episode.scenes.length}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {tab === "world" && (
            <section className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
              <div className="panel-glass overflow-hidden rounded-2xl">
                <div className="relative h-40 sm:h-52">
                  <img src="/studio/backdrops/palace-dusk.jpg" alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-[11px] tracking-widest text-primary">TAMKANG × TAMSUI</div>
                    <h2 className="text-xl font-semibold sm:text-2xl">{world.title}</h2>
                    <p className="mt-1 text-sm text-muted">{world.episode.logline}</p>
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {[
                    ["地區", world.setting.region],
                    ["校園", world.setting.campus],
                    ["基調", world.setting.tone],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-surface-2/80 px-3 py-2">
                      <div className="text-[10px] text-muted">{k}</div>
                      <div className="text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4 text-accent" />
                  {world.episode.title}
                </h3>
                <div className="space-y-2">
                  {world.episode.scenes.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSceneId(s.id);
                        setTab("script");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/80 px-3 py-3 text-left transition hover:border-primary/35"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.title}</div>
                        <div className="truncate text-[11px] text-muted">
                          {locName(s.locationId)} · {s.beats.length} 節拍 · {s.characters.map(charName).join("、")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addScene}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  新增場次
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTab("stage")} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
                  打開虛擬舞台
                </button>
                <a href="/play" className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm">
                  3D 校園遊玩
                </a>
                <button type="button" onClick={() => setTab("github")} className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm">
                  接 GitHub 持續開發
                </button>
              </div>
            </section>
          )}

          {tab === "locations" && (
            <section className="grid gap-4 p-4 lg:grid-cols-[1fr_1.1fr] sm:p-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted">世界地圖 · 淡江／淡水</h3>
                {world.locations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLocId(l.id)}
                    className={`flex w-full gap-3 rounded-xl border p-2 text-left ${
                      locId === l.id ? "border-primary/40 bg-primary/10" : "border-border bg-surface/70"
                    }`}
                  >
                    <img src={l.backdrop} alt="" className="h-16 w-20 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-[11px] text-muted">
                        {l.area === "campus" ? "校園" : "淡水"} · {l.mood}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {(l.tags ?? []).map((t) => (
                          <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedLoc && (
                <div className="panel-glass overflow-hidden rounded-2xl">
                  <img src={selectedLoc.backdrop} alt="" className="h-48 w-full object-cover" />
                  <div className="space-y-3 p-4">
                    <div>
                      <div className="text-[11px] text-primary">{selectedLoc.en}</div>
                      <h3 className="text-xl font-semibold">{selectedLoc.name}</h3>
                      <p className="mt-1 text-sm text-muted">{selectedLoc.mood}</p>
                    </div>
                    <label className="block text-[11px] text-muted">
                      場景說明（可編輯）
                      <textarea
                        value={selectedLoc.desc}
                        onChange={(e) => {
                          setWorld({
                            ...world,
                            locations: world.locations.map((l) =>
                              l.id === selectedLoc.id ? { ...l, desc: e.target.value } : l,
                            ),
                          });
                        }}
                        rows={4}
                        className="mt-1 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-primary/40"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-sm text-primary"
                      onClick={() => {
                        const sc = world.episode.scenes.find((s) => s.locationId === selectedLoc.id);
                        if (sc) {
                          setSceneId(sc.id);
                          setTab("stage");
                        } else flash("尚無此場景的場次，請在劇本新增");
                      }}
                    >
                      在舞台預覽此景 →
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "characters" && (
            <section className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              {world.characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCharId(c.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition ${
                    charId === c.id ? "border-primary/50 shadow-glow" : "border-border"
                  }`}
                >
                  <div className="relative h-44 bg-surface-2">
                    <img src={c.avatar} alt={c.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg to-transparent p-3">
                      <div className="text-lg font-semibold" style={{ color: c.color }}>
                        {c.name}
                      </div>
                      <div className="text-xs text-muted">{c.role}</div>
                    </div>
                  </div>
                  <div className="space-y-1 bg-surface/90 p-3 text-xs">
                    <div>
                      <span className="text-muted">特質 · </span>
                      {c.trait}
                    </div>
                    <div>
                      <span className="text-muted">目標 · </span>
                      {c.goal}
                    </div>
                  </div>
                </button>
              ))}
              {selectedChar && (
                <div className="panel-glass rounded-2xl p-4 sm:col-span-2 lg:col-span-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Pencil className="h-4 w-4 text-primary" />
                    編輯 {selectedChar.name}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] text-muted">
                      特質
                      <input
                        value={selectedChar.trait}
                        onChange={(e) =>
                          setWorld({
                            ...world,
                            characters: world.characters.map((c) =>
                              c.id === selectedChar.id ? { ...c, trait: e.target.value } : c,
                            ),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
                      />
                    </label>
                    <label className="text-[11px] text-muted">
                      目標
                      <input
                        value={selectedChar.goal}
                        onChange={(e) =>
                          setWorld({
                            ...world,
                            characters: world.characters.map((c) =>
                              c.id === selectedChar.id ? { ...c, goal: e.target.value } : c,
                            ),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg"
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "script" && (
            <section className="grid min-h-full gap-0 lg:grid-cols-[240px_1fr]">
              <div className="border-b border-border p-3 lg:border-b-0 lg:border-r">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">場次</span>
                  <button type="button" onClick={addScene} className="text-primary">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {world.episode.scenes.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSceneId(s.id)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs ${
                        sceneId === s.id ? "bg-primary/15 text-primary" : "hover:bg-surface-2 text-fg"
                      }`}
                    >
                      <span className="text-muted">{i + 1}. </span>
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
              {scene && (
                <div className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        value={scene.title}
                        onChange={(e) => updateScene(scene.id, { title: e.target.value })}
                        className="w-full bg-transparent text-lg font-semibold outline-none"
                      />
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                        <select
                          value={scene.locationId}
                          onChange={(e) => updateScene(scene.id, { locationId: e.target.value })}
                          className="rounded-lg border border-border bg-surface-2 px-2 py-1"
                        >
                          {world.locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <span>出場：{scene.characters.map(charName).join("、")}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setTab("stage")} className="btn-primary rounded-lg px-3 py-2 text-xs">
                      舞台預覽
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scene.beats.map((b, i) => (
                      <div
                        key={i}
                        className="group flex gap-2 rounded-xl border border-border/70 bg-surface/60 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1 text-sm leading-relaxed">
                          {b.type === "dialogue" ? (
                            <>
                              <span className="font-semibold text-primary">{charName(b.speaker ?? "")}</span>
                              <span className="text-muted">　</span>
                              {b.text}
                            </>
                          ) : b.type === "action" ? (
                            <span className="italic text-muted">（{b.text}）</span>
                          ) : (
                            <span className="text-accent">註：{b.text}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBeat(i)}
                          className="shrink-0 opacity-0 transition group-hover:opacity-100 text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-surface/80 p-3">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {(["dialogue", "action", "note"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setBeatType(t)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${
                            beatType === t ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted"
                          }`}
                        >
                          {t === "dialogue" ? "對白" : t === "action" ? "動作" : "註記"}
                        </button>
                      ))}
                      {beatType === "dialogue" && (
                        <select
                          value={beatSpeaker}
                          onChange={(e) => setBeatSpeaker(e.target.value)}
                          className="rounded-lg border border-border bg-bg px-2 py-1 text-[11px]"
                        >
                          {world.characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <textarea
                      value={beatDraft}
                      onChange={(e) => setBeatDraft(e.target.value)}
                      rows={2}
                      placeholder={beatType === "dialogue" ? "輸入對白…" : "輸入內容…"}
                      className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary/40"
                    />
                    <button type="button" onClick={addBeat} className="btn-primary mt-2 rounded-lg px-4 py-2 text-xs">
                      加入節拍
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "stage" && scene && location && (
            <section className="flex min-h-full flex-col p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] text-primary">虛擬舞台 · {location.name}</div>
                  <h3 className="text-lg font-semibold">{scene.title}</h3>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTab("script")} className="rounded-lg border border-border px-3 py-2 text-xs">
                    回劇本
                  </button>
                  <a href="/play" className="btn-primary rounded-lg px-3 py-2 text-xs">
                    3D 世界遊玩
                  </a>
                </div>
              </div>
              <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border shadow-2xl">
                <div className="relative aspect-video">
                  <img src={location.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-4 sm:p-6">
                    {scene.characters.map((cid) => {
                      const c = world.characters.find((x) => x.id === cid);
                      if (!c) return null;
                      return (
                        <div key={cid} className="flex flex-col items-center">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="h-28 w-20 rounded-lg object-cover shadow-xl ring-2 sm:h-40 sm:w-28"
                            style={{ boxShadow: `0 0 0 2px ${c.color}` }}
                          />
                          <span className="mt-1 rounded bg-black/50 px-2 py-0.5 text-[11px]" style={{ color: c.color }}>
                            {c.name}
                          </span>
                        </div>
                      );
                    })}
                    <div className="ml-auto max-w-md rounded-xl bg-black/55 p-3 text-sm backdrop-blur-sm">
                      {(() => {
                        const last = [...scene.beats].reverse().find((b) => b.type === "dialogue");
                        if (!last) return <span className="text-muted">（尚無對白）</span>;
                        return (
                          <>
                            <div className="text-[11px] text-primary">{charName(last.speaker ?? "")}</div>
                            <div>{last.text}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mx-auto mt-4 w-full max-w-4xl">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <Layers className="h-3.5 w-3.5" />
                  本場節拍預覽
                </div>
                <ol className="space-y-1.5 text-sm">
                  {scene.beats.map((b, i) => (
                    <li key={i} className="rounded-lg bg-surface/60 px-3 py-2">
                      {b.type === "dialogue" ? (
                        <>
                          <strong className="text-primary">{charName(b.speaker ?? "")}</strong>：{b.text}
                        </>
                      ) : b.type === "action" ? (
                        <em className="text-muted">（{b.text}）</em>
                      ) : (
                        <span className="text-accent">註：{b.text}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {tab === "github" && (
            <section className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
              <div className="panel-glass rounded-2xl p-5">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Github className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">GitHub 持續開發</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  把這個淡江·淡水劇本世界當成可版控的工程：匯出 <code className="text-primary/90">world.json</code>{" "}
                  與劇本 Markdown，推到你的 repo，之後每集、每地點都用 PR 擴充——像在開發一個世界。
                </p>
              </div>

              <label className="block text-[11px] text-muted">
                Owner（GitHub 帳號或組織）
                <input
                  value={gh.owner}
                  onChange={(e) => setGh({ ...gh, owner: e.target.value })}
                  placeholder="your-github-username"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary/40"
                />
              </label>
              <label className="block text-[11px] text-muted">
                Repository
                <input
                  value={gh.repo}
                  onChange={(e) => setGh({ ...gh, repo: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary/40"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] text-muted">
                  Branch
                  <input
                    value={gh.branch}
                    onChange={(e) => setGh({ ...gh, branch: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg"
                  />
                </label>
                <label className="block text-[11px] text-muted">
                  路徑前綴
                  <input
                    value={gh.pathPrefix}
                    onChange={(e) => setGh({ ...gh, pathPrefix: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    saveGithubTarget(gh);
                    flash("GitHub 設定已存");
                  }}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm"
                >
                  儲存設定
                </button>
                <button type="button" onClick={exportGithubPack} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
                  匯出可 commit 檔案
                </button>
                <button type="button" onClick={copyCommitMessage} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm">
                  <Copy className="h-3.5 w-3.5" />
                  複製 commit 訊息
                </button>
                {gh.owner && gh.repo && (
                  <a
                    href={`https://github.com/${gh.owner}/${gh.repo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    開啟 Repo
                  </a>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/50 p-4 text-xs leading-relaxed text-muted">
                <div className="mb-2 font-semibold text-fg">建議工作流</div>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>在編輯器改劇本／地點／角色 → 本機存檔</li>
                  <li>匯出 pack（含 README、SCRIPT、world.json）</li>
                  <li>
                    在 GitHub 建立 <code className="text-primary/80">{gh.repo || "tku-tamsui-drama-world"}</code>
                  </li>
                  <li>把檔案放進 repo 後持續用 PR 開第二集、支線</li>
                  <li>需要時跟我說 repo 名稱，我可以幫你推第一版結構</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!world) return;
                  const files = buildWorldFiles(world, world.title);
                  const readme = files.find((f) => f.path === "README.md");
                  if (readme) downloadText("README.md", readme.content);
                  flash("README 已下載");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 py-3 text-sm text-primary"
              >
                <Sparkles className="h-4 w-4" />
                下載世界 README 範本
              </button>
            </section>
          )}
        </main>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="panel-glass rounded-full px-4 py-2 text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}
