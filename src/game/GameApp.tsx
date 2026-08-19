import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { CampusScene } from "./scene/CampusScene";
import { useGame, type HudState } from "./store";
import { audio } from "./audio";
import { ITEMS, STAMP_LABELS, MAP_W, MAP_H } from "./data";
import { CELL } from "./store";
import type { ItemId } from "./types";
import {
  Heart,
  Coins,
  Swords,
  Shield,
  Backpack,
  MapPin,
  Play,
  RotateCcw,
  MessageCircle,
  Sparkles,
  Crown,
  ScrollText,
  Zap,
  Volume2,
  VolumeX,
  Map as MapIcon,
  X,
} from "lucide-react";

function markerForArea(area: string | null): { x: number; y: number; label: string } {
  if (!area) return { x: 28, y: 72, label: "宮燈大道" };
  if (area.includes("校門")) return { x: 48, y: 88, label: area };
  if (area.includes("宮燈")) return { x: 18, y: 28, label: area };
  if (area.includes("書卷") || area.includes("圖書")) return { x: 78, y: 42, label: area };
  if (area.includes("體育") || area.includes("活動")) return { x: 42, y: 48, label: area };
  if (area.includes("驚聲")) return { x: 48, y: 22, label: area };
  return { x: 28, y: 55, label: area };
}

export function GameApp() {
  const [hud, setHud] = useState<HudState | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const initNew = useGame((s) => s.initNew);
  const continueGame = useGame((s) => s.continueGame);
  const setPhase = useGame((s) => s.setPhase);
  const setKey = useGame((s) => s.setKey);
  const setTouch = useGame((s) => s.setTouch);
  const queueAttack = useGame((s) => s.queueAttack);
  const queueInteract = useGame((s) => s.queueInteract);
  const queueDash = useGame((s) => s.queueDash);
  const advanceDialogue = useGame((s) => s.advanceDialogue);
  const useItem = useGame((s) => s.useItem);
  const getHud = useGame((s) => s.getHud);
  const phase = useGame((s) => s.phase);
  const setLook = useGame((s) => s.setLook);

  const onMoveStick = useCallback((x: number, y: number) => setTouch(x, y), [setTouch]);
  const onLookStick = useCallback((v: number) => setLook(v), [setLook]);

  useEffect(() => {
    setHasSave(useGame.getState().hasSave());
    const id = window.setInterval(() => setHud(getHud()), 100);
    return () => clearInterval(id);
  }, [getHud]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyM" && !e.repeat) {
        if (phase === "playing" || phase === "paused" || mapOpen) {
          e.preventDefault();
          setMapOpen((v) => !v);
        }
        return;
      }
      if (e.code === "Escape") {
        if (mapOpen) {
          setMapOpen(false);
          return;
        }
        if (phase === "playing") setPhase("paused");
        else if (phase === "paused") setPhase("playing");
        return;
      }
      if (e.code === "KeyI") {
        if (phase === "playing") setPhase("inventory");
        else if (phase === "inventory") setPhase("playing");
        return;
      }
      if (phase === "dialogue" && (e.code === "Space" || e.code === "Enter" || e.code === "KeyE")) {
        e.preventDefault();
        advanceDialogue();
        return;
      }
      if (phase === "playing" && e.code === "KeyE" && !e.repeat) {
        e.preventDefault();
        queueInteract();
        return;
      }
      setKey(e.code, true);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => setKey(e.code, false);
    const blur = () => {
      useGame.getState().keys.clear();
      setTouch(0, 0);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [phase, mapOpen, setKey, setPhase, setTouch, advanceDialogue, queueInteract]);

  const toggleMute = useCallback(() => {
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    if (!audio.muted) {
      audio.unlock();
      audio.play("ui");
    }
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg select-none">
      <Canvas
        className="absolute inset-0 pointer-events-none"
        style={{ touchAction: "none" }}
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#87b5d4");
          gl.domElement.style.pointerEvents = "none";
          gl.domElement.style.touchAction = "none";
        }}
      >
        <Suspense fallback={null}>
          <CampusScene />
        </Suspense>
      </Canvas>

      <div className="absolute right-3 top-3 z-30 flex gap-2">
        {(phase === "playing" || phase === "paused" || mapOpen || phase === "title") && (
          <button
            type="button"
            onClick={() => {
              audio.play("ui");
              setMapOpen((v) => !v);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-3 text-xs font-medium text-fg backdrop-blur-sm"
          >
            <MapIcon className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">校園地圖</span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-surface/80 text-muted backdrop-blur-sm"
          aria-label={muted ? "開啟聲音" : "靜音"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {phase === "title" && (
        <TitleScreen
          hasSave={hasSave}
          onNew={initNew}
          onContinue={continueGame}
          onOpenMap={() => setMapOpen(true)}
        />
      )}

      {hud && (phase === "playing" || phase === "dialogue" || phase === "inventory" || phase === "paused") && (
        <HudOverlay hud={hud} />
      )}

      {phase === "dialogue" && hud?.dialogue && (
        <DialogueBox
          speaker={hud.dialogue.speaker}
          text={hud.dialogue.lines[hud.dialogue.index] ?? ""}
          onAdvance={advanceDialogue}
        />
      )}

      {phase === "inventory" && hud && (
        <InventoryPanel hud={hud} onUse={(id) => useItem(id)} onClose={() => setPhase("playing")} />
      )}

      {phase === "paused" && (
        <PauseMenu
          onResume={() => setPhase("playing")}
          onRestart={initNew}
          onOpenMap={() => setMapOpen(true)}
        />
      )}

      {phase === "dead" && (
        <EndScreen
          title="體力透支"
          subtitle="迎新挑戰先告一段落。回宮燈大道喘口氣，再出發吧。"
          action="重新導覽"
          onAction={initNew}
        />
      )}

      {phase === "victory" && (
        <EndScreen
          title="新生導覽完成！"
          subtitle="安倢通過張哲維的迎新挑戰，找到柏能學長，正式成為淡江人。歡迎加入淡江大學！"
          action="再玩一次"
          victory
          onAction={initNew}
        />
      )}

      {hud?.toast && (
        <div className="pointer-events-none absolute left-1/2 top-[4.75rem] z-20 -translate-x-1/2">
          <div className="panel-glass rounded-full px-5 py-2.5 text-sm font-medium text-fg">{hud.toast}</div>
        </div>
      )}

      {hud?.areaName && phase === "playing" && !mapOpen && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2">
          <div className="rounded-full border border-primary/25 bg-surface/70 px-4 py-1 text-xs font-medium tracking-wide text-primary backdrop-blur-md">
            {hud.areaName}
          </div>
        </div>
      )}

      {/* desktop: drag middle/right to turn camera */}
      {phase === "playing" && !mapOpen && (
        <CameraDragLayer onLook={onLookStick} />
      )}

      {phase === "playing" && !mapOpen && (
        <MobileControls
          dashReady={hud?.dashReady ?? true}
          onMove={onMoveStick}
          onLook={onLookStick}
          onAttack={queueAttack}
          onInteract={queueInteract}
          onInventory={() => setPhase("inventory")}
          onDash={queueDash}
          onMap={() => setMapOpen(true)}
        />
      )}

      {mapOpen && (
        <CampusMapPanel areaName={hud?.areaName ?? null} phase={phase} onClose={() => setMapOpen(false)} />
      )}
    </div>
  );
}

function TitleScreen({
  hasSave,
  onNew,
  onContinue,
  onOpenMap,
}: {
  hasSave: boolean;
  onNew: () => void;
  onContinue: () => void;
  onOpenMap: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden px-5">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, rgb(10 14 20 / 0.35) 0%, rgb(10 14 20 / 0.72) 50%, rgb(10 14 20 / 0.92) 100%)",
        }}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="mb-5 flex items-end gap-3">
          <div className="overflow-hidden rounded-2xl border border-primary/30 bg-surface shadow-[var(--shadow-glow)]">
            <img src="/sprites/anjie-portrait.png" alt="安倢" className="h-24 w-24 object-cover object-top sm:h-28 sm:w-28" />
          </div>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-surface/80 text-primary">
            <MapIcon className="h-5 w-5" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
            <img src="/map/tku-campus-art.jpg" alt="淡江校園" className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
          </div>
        </div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-medium tracking-[0.22em] text-muted uppercase">3D Tamkang Campus Tour</span>
        </div>
        <h1 className="text-glow mb-2 text-center font-display text-3xl font-bold tracking-tight text-fg sm:text-5xl">
          淡江新生導覽
        </h1>
        <p className="mb-1 text-center text-sm font-medium text-primary sm:text-base">3D 校園闖關 · 安倢</p>
        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-muted">
          走進立體淡水校園：宮燈大道、圖書館、體育館到驚聲廣場，完成迎新挑戰。
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button type="button" onClick={onNew} className="btn-primary flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base">
            <Play className="h-4 w-4" />
            開始導覽
          </button>
          {hasSave && (
            <button type="button" onClick={onContinue} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/90 px-5 py-3.5 text-base font-medium">
              <RotateCcw className="h-4 w-4" />
              繼續進度
            </button>
          )}
          <button type="button" onClick={onOpenMap} className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-medium text-primary">
            <MapIcon className="h-4 w-4" />
            查看淡水校園地圖
          </button>
        </div>
        <div className="mt-10 hidden w-full max-w-lg grid-cols-3 gap-2 sm:grid">
          <ControlChip label="移動" value="WASD" />
          <ControlChip label="轉鏡頭" value="Q / R · 滑鼠拖曳" />
          <ControlChip label="攻擊" value="空白 / J" />
          <ControlChip label="衝刺" value="Shift / K" />
          <ControlChip label="對話" value="E" />
          <ControlChip label="地圖" value="M" />
        </div>
        <p className="mt-6 text-center text-xs text-muted sm:hidden">左搖桿移動 · 右「視角」轉鏡頭 · 談／攻</p>
      </div>
    </div>
  );
}

function ControlChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-glass rounded-lg px-3 py-2">
      <div className="text-[10px] tracking-wider text-muted">{label}</div>
      <div className="text-sm font-medium text-fg">{value}</div>
    </div>
  );
}

function HudOverlay({ hud }: { hud: HudState }) {
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const xpPct = Math.max(0, Math.min(1, hud.xp / hud.xpToNext));
  const activeQuests = hud.quests.filter((q) => q.status === "active" || q.status === "complete");
  const lowHp = hpPct < 0.35;

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-10 w-[min(100%-1.5rem,288px)] space-y-2">
        <div className="panel-glass rounded-xl p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Lv.{hud.level}</span>
              <span className="text-sm font-medium text-fg">安倢 · 新生</span>
              {hud.flags.princess_rescued && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Crown className="h-3 w-3" />
                  完課
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-accent">
              <Coins className="h-3.5 w-3.5" />
              {hud.gold}
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Heart className={`h-3.5 w-3.5 shrink-0 ${lowHp ? "text-danger animate-pulse" : "text-hp"}`} />
            <div className="bar-track h-2.5 flex-1 overflow-hidden rounded-full">
              <div className={`h-full rounded-full ${lowHp ? "bg-danger" : "bg-hp"}`} style={{ width: `${hpPct * 100}%` }} />
            </div>
            <span className="w-14 text-right text-[11px] tabular-nums text-muted">
              {Math.ceil(hud.hp)}/{hud.maxHp}
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-xp" />
            <div className="bar-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="h-full rounded-full bg-xp" style={{ width: `${xpPct * 100}%` }} />
            </div>
            <span className="w-14 text-right text-[11px] text-muted">XP</span>
          </div>
          <div className="mb-2.5 flex items-center gap-2">
            <Zap className={`h-3.5 w-3.5 shrink-0 ${hud.dashReady ? "text-primary" : "text-muted"}`} />
            <div className="bar-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="h-full rounded-full bg-primary" style={{ width: hud.dashReady ? "100%" : "30%" }} />
            </div>
            <span className="w-14 text-right text-[11px] text-muted">{hud.dashReady ? "就緒" : "衝刺"}</span>
          </div>
          <div className="flex gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Swords className="h-3 w-3 text-primary" />
              ATK {hud.atk}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-mp" />
              DEF {hud.def}
            </span>
          </div>
        </div>
        {activeQuests.length > 0 && (
          <div className="panel-glass rounded-xl p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted">
              <ScrollText className="h-3 w-3 text-accent" />
              任務
            </div>
            {activeQuests.map((q) => (
              <div key={q.id} className="mb-1.5 last:mb-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={q.status === "complete" ? "font-medium text-primary" : "text-fg"}>
                    {q.status === "complete" ? "✓ " : ""}
                    {q.title}
                  </span>
                  <span className="tabular-nums text-muted">
                    {q.progress}/{q.goal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {hud.stamps && (
          <div className="panel-glass rounded-xl p-3">
            <div className="mb-2 text-[10px] font-semibold tracking-wider text-muted">新生戳章 {hud.stamps.length}/5</div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(STAMP_LABELS).map((id) => {
                const got = hud.stamps.includes(id);
                return (
                  <span
                    key={id}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                      got ? "bg-primary/20 text-primary" : "bg-surface-2/60 text-muted"
                    }`}
                  >
                    {got ? "✓ " : ""}
                    {STAMP_LABELS[id]}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hud.objective && (
        <div className="pointer-events-none absolute right-3 top-14 z-10 hidden w-48 sm:block">
          <div className="panel-glass rounded-xl px-3 py-2">
            <div className="text-[10px] tracking-wider text-muted">目前目標</div>
            <div className="text-xs font-medium text-primary">{hud.objective.label}</div>
          </div>
        </div>
      )}

      <Minimap hud={hud} />

      {hud.bossHp && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 w-[min(92%,360px)] -translate-x-1/2">
          <div className="panel-glass rounded-xl px-4 py-2.5">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#d4b0ff]">{hud.bossHp.name}</span>
              <span className="tabular-nums text-muted">
                {Math.ceil(hud.bossHp.hp)}/{hud.bossHp.maxHp}
              </span>
            </div>
            <div className="bar-track h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7b4dff] to-[#c77dff]"
                style={{ width: `${(hud.bossHp.hp / hud.bossHp.maxHp) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {hud.interactHint && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 sm:bottom-10">
          <div className="panel-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>{hud.interactHint}</span>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 sm:block">
        <div className="rounded-full border border-border/50 bg-surface/50 px-3 py-1 text-[10px] text-muted backdrop-blur-sm">
          WASD 朝鏡頭方向走 · Q/R 轉鏡頭 · 滑鼠拖曳轉視角 · E 對話 · 空白攻擊
        </div>
      </div>
    </>
  );
}

function DialogueBox({ speaker, text, onAdvance }: { speaker: string; text: string; onAdvance: () => void }) {
  const isBuddy = speaker.includes("柏能");
  const isGuide = speaker.includes("總召") || speaker.includes("小雨");
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:p-6">
      <button type="button" onClick={onAdvance} className="panel-glass w-full max-w-2xl rounded-2xl p-4 text-left sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
              isBuddy ? "bg-rose/20 text-rose" : isGuide ? "bg-primary/20 text-primary" : "bg-accent/15 text-accent"
            }`}
          >
            {speaker}
          </span>
          <span className="text-[10px] text-muted">點擊繼續</span>
        </div>
        <p className="text-[15px] leading-relaxed text-fg sm:text-base">{text}</p>
      </button>
    </div>
  );
}

function InventoryPanel({
  hud,
  onUse,
  onClose,
}: {
  hud: HudState;
  onUse: (id: ItemId) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm">
      <div className="panel-glass w-full max-w-md rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Backpack className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">背包</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted">
            關閉 (I)
          </button>
        </div>
        {hud.inventory.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">背包是空的</p>
        ) : (
          <ul className="space-y-2">
            {hud.inventory.map((slot) => {
              const def = ITEMS[slot.id];
              return (
                <li key={slot.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/50 px-3 py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {def.name} <span className="text-muted">×{slot.count}</span>
                    </div>
                    <div className="text-xs text-muted">{def.desc}</div>
                  </div>
                  {def.heal && (
                    <button type="button" onClick={() => onUse(slot.id)} className="btn-primary shrink-0 rounded-lg px-3 py-1.5 text-xs">
                      使用
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-accent" />
            校園幣 {hud.gold}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {hud.areaName ?? "淡水校園"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PauseMenu({
  onResume,
  onRestart,
  onOpenMap,
}: {
  onResume: () => void;
  onRestart: () => void;
  onOpenMap: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/75 p-4 backdrop-blur-sm">
      <div className="panel-glass w-full max-w-xs rounded-2xl p-6 text-center">
        <h2 className="mb-1 text-xl font-semibold">暫停</h2>
        <p className="mb-5 text-sm text-muted">3D 淡江新生導覽</p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onResume} className="btn-primary rounded-xl px-4 py-3">
            繼續
          </button>
          <button type="button" onClick={onOpenMap} className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            <MapIcon className="h-4 w-4" />
            校園地圖
          </button>
          <button type="button" onClick={onRestart} className="rounded-xl border border-border px-4 py-3 text-sm text-muted">
            重新導覽
          </button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({
  title,
  subtitle,
  action,
  onAction,
  victory,
}: {
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
  victory?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-5 backdrop-blur-md">
      <div className="panel-glass max-w-md rounded-2xl p-8 text-center">
        {victory && (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Crown className="h-7 w-7" />
          </div>
        )}
        <h2 className={`mb-3 font-display text-2xl font-bold ${victory ? "text-primary text-glow" : "text-fg"}`}>{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted">{subtitle}</p>
        <button type="button" onClick={onAction} className="btn-primary rounded-xl px-6 py-3">
          {action}
        </button>
      </div>
    </div>
  );
}

function CampusMapPanel({
  areaName,
  phase,
  onClose,
}: {
  areaName: string | null;
  phase: string;
  onClose: () => void;
}) {
  const marker = markerForArea(areaName);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="panel-glass relative flex max-h-[min(92dvh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <MapIcon className="h-4 w-4" />
              <span className="text-sm font-semibold">淡江大學 · 淡水校園地圖</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              官方平面圖 · 你目前在：
              <span className="ml-1 font-medium text-primary">{marker.label}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-auto bg-[#e8dfd0] p-2 sm:p-3">
          <div className="relative mx-auto w-full max-w-[640px]">
            <img src="/map/tku-official-ui.png" alt="淡江大學淡水校園地圖" className="h-auto w-full rounded-lg shadow-lg" draggable={false} />
            {phase !== "title" && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-fg shadow-md">你在這裡</span>
                  <div className="h-3 w-3 animate-pulse rounded-full bg-primary ring-4 ring-primary/35" />
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="px-4 py-3 text-center text-[10px] text-muted">按 M 開關 · 3D 場景為導覽簡化版</p>
      </div>
    </div>
  );
}


function Minimap({ hud }: { hud: HudState }) {
  // map player world pos to 0..1 of campus tile grid
  const px = hud.playerPos.x / CELL + MAP_W / 2;
  const pz = hud.playerPos.z / CELL + MAP_H / 2;
  const left = Math.max(4, Math.min(96, (px / MAP_W) * 100));
  const top = Math.max(4, Math.min(96, (pz / MAP_H) * 100));
  let ox = 50;
  let ot = 50;
  if (hud.objective) {
    const oxp = hud.objective.x / CELL + MAP_W / 2;
    const ozp = hud.objective.z / CELL + MAP_H / 2;
    ox = Math.max(4, Math.min(96, (oxp / MAP_W) * 100));
    ot = Math.max(4, Math.min(96, (ozp / MAP_H) * 100));
  }
  return (
    <div className="pointer-events-none absolute bottom-28 right-3 z-10 hidden sm:block">
      <div className="panel-glass relative h-28 w-28 overflow-hidden rounded-xl border border-border/60">
        <img src="/map/tku-campus-art.jpg" alt="" className="h-full w-full object-cover opacity-80" draggable={false} />
        {hud.objective && (
          <div
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow"
            style={{ left: `${ox}%`, top: `${ot}%` }}
          />
        )}
        <div
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-primary/40"
          style={{ left: `${left}%`, top: `${top}%` }}
        />
        <div className="absolute bottom-1 left-1 rounded bg-bg/70 px-1 text-[9px] text-muted">小地圖</div>
      </div>
    </div>
  );
}

function CameraDragLayer({ onLook }: { onLook: (v: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      // only primary button drag on empty area (not UI)
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input, [data-testid='virtual-joystick'], [data-testid='look-stick'], [data-no-cam]")) return;
      // left third is joystick zone on mobile — skip
      if (e.pointerType !== "mouse" && e.clientX < window.innerWidth * 0.42) return;
      if (e.pointerType !== "mouse" && e.clientX > window.innerWidth * 0.55 && e.clientY > window.innerHeight * 0.55) return;
      dragging.current = true;
      lastX.current = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      // map pixel drag to look -1..1
      const v = Math.max(-1, Math.min(1, dx * 0.04));
      onLook(v);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      onLook(0);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onLook]);
  return null;
}

function MobileControls({
  dashReady,
  onMove,
  onLook,
  onAttack,
  onInteract,
  onInventory,
  onDash,
  onMap,
}: {
  dashReady: boolean;
  onMove: (x: number, y: number) => void;
  onLook: (v: number) => void;
  onAttack: () => void;
  onInteract: () => void;
  onInventory: () => void;
  onDash: () => void;
  onMap: () => void;
}) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const lookKnobRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const lookActive = useRef(false);
  const pointerId = useRef<number | null>(null);
  const lookPid = useRef<number | null>(null);

  const applyStick = useCallback(
    (clientX: number, clientY: number) => {
      const el = stickRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const maxR = Math.max(28, r.width * 0.45);
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > maxR && len > 0) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      const nx = dx / maxR;
      const ny = dy / maxR;
      if (Math.hypot(nx, ny) < 0.08) {
        onMove(0, 0);
        return;
      }
      // slight boost for ease
      const mag = Math.min(1, Math.hypot(nx, ny) * 1.15);
      const ang = Math.atan2(ny, nx);
      onMove(Math.cos(ang) * mag, Math.sin(ang) * mag);
    },
    [onMove],
  );

  const applyLook = useCallback(
    (clientX: number, clientY: number) => {
      const el = lookRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const maxR = Math.max(24, r.width * 0.42);
      let dx = clientX - cx;
      if (Math.abs(dx) > maxR) dx = Math.sign(dx) * maxR;
      if (lookKnobRef.current) {
        lookKnobRef.current.style.transform = `translate(calc(-50% + ${dx}px), -50%)`;
      }
      const v = dx / maxR;
      onLook(Math.abs(v) < 0.1 ? 0 : v);
    },
    [onLook],
  );

  const endStick = useCallback(() => {
    active.current = false;
    pointerId.current = null;
    onMove(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%, -50%)";
  }, [onMove]);

  const endLook = useCallback(() => {
    lookActive.current = false;
    lookPid.current = null;
    onLook(0);
    if (lookKnobRef.current) lookKnobRef.current.style.transform = "translate(-50%, -50%)";
  }, [onLook]);

  useEffect(() => {
    const onMoveGlobal = (e: PointerEvent) => {
      if (active.current && pointerId.current === e.pointerId) {
        e.preventDefault();
        applyStick(e.clientX, e.clientY);
      }
      if (lookActive.current && lookPid.current === e.pointerId) {
        e.preventDefault();
        applyLook(e.clientX, e.clientY);
      }
    };
    const onUpGlobal = (e: PointerEvent) => {
      if (active.current && pointerId.current === e.pointerId) endStick();
      if (lookActive.current && lookPid.current === e.pointerId) endLook();
    };
    window.addEventListener("pointermove", onMoveGlobal, { passive: false });
    window.addEventListener("pointerup", onUpGlobal);
    window.addEventListener("pointercancel", onUpGlobal);
    return () => {
      window.removeEventListener("pointermove", onMoveGlobal);
      window.removeEventListener("pointerup", onUpGlobal);
      window.removeEventListener("pointercancel", onUpGlobal);
    };
  }, [applyStick, applyLook, endStick, endLook]);

  // clear once on unmount only (stable refs avoid wiping stick every parent re-render)
  const onMoveRef = useRef(onMove);
  const onLookRef = useRef(onLook);
  onMoveRef.current = onMove;
  onLookRef.current = onLook;
  useEffect(() => () => {
    onMoveRef.current(0, 0);
    onLookRef.current(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyK") && e.type === "keydown" && !e.repeat) {
        onDash();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDash]);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 lg:hidden">
      {/* move stick */}
      <div
        ref={stickRef}
        data-testid="virtual-joystick"
        className="pointer-events-auto absolute bottom-10 left-4 h-36 w-36 touch-none rounded-full border-2 border-white/30 bg-black/45 shadow-xl backdrop-blur-md"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          active.current = true;
          pointerId.current = e.pointerId;
          try { stickRef.current?.setPointerCapture(e.pointerId); } catch { /* */ }
          applyStick(e.clientX, e.clientY);
        }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/40">
          移動
        </div>
        <div
          ref={knobRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 rounded-full border-2 border-primary/60 bg-primary/50 shadow-[0_0_20px_rgba(94,228,168,0.45)]"
          style={{ transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* look stick */}
      <div
        ref={lookRef}
        data-testid="look-stick"
        className="pointer-events-auto absolute bottom-36 right-5 h-24 w-24 touch-none rounded-full border-2 border-white/25 bg-black/40 shadow-lg backdrop-blur-md"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          lookActive.current = true;
          lookPid.current = e.pointerId;
          try { lookRef.current?.setPointerCapture(e.pointerId); } catch { /* */ }
          applyLook(e.clientX, e.clientY);
        }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/40">
          視角
        </div>
        <div
          ref={lookKnobRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 rounded-full border border-sky-300/50 bg-sky-400/40"
          style={{ transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* action buttons */}
      <div className="pointer-events-auto absolute bottom-8 right-4 flex flex-col items-end gap-2" data-no-cam>
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onMap(); }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface/85 text-primary shadow-md"
            aria-label="地圖"
          >
            <MapIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onInventory(); }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface/85 shadow-md"
            aria-label="背包"
          >
            <Backpack className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onInteract(); }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/25 text-sm font-bold text-amber-100 shadow-md"
          >
            談
          </button>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onDash(); }}
            className={`flex h-14 w-14 items-center justify-center rounded-full border text-sm font-bold shadow-md ${
              dashReady ? "border-primary/50 bg-primary/35 text-primary" : "border-border bg-surface/60 text-muted"
            }`}
          >
            衝
          </button>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onAttack(); }}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-primary/45 text-base font-bold text-primary-fg shadow-lg"
          >
            攻
          </button>
        </div>
      </div>
    </div>
  );
}
