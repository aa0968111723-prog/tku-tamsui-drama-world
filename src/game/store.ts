import { create } from "zustand";
import {
  TILE,
  ITEMS,
  createInitialQuests,
  createNpcs,
  createEnemies,
  CAMPUS_BUILDINGS,
  playerMaxHpForLevel,
  playerAtkForLevel,
  playerDefForLevel,
  xpForLevel,
  buildTileMap,
  isSolidTile,
  MAP_W,
  MAP_H,
  STAMP_NPC_IDS,
  STAMP_LABELS,
} from "./data";
import type { GamePhase, InventorySlot, ItemId, Quest, Dir } from "./types";
import { audio } from "./audio";

export const CELL = 2.2; // world units per tile

export type Vec3 = { x: number; y: number; z: number };

export type Npc3 = {
  id: string;
  name: string;
  x: number;
  z: number;
  lines: string[][];
  questId?: string;
};

export type Enemy3 = {
  id: string;
  kind: "slime" | "goblin" | "boss";
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  xp: number;
  gold: number;
  dead: boolean;
  boss?: boolean;
  aggro: number;
  hitFlash: number;
  phase: number;
};

export type Building3 = {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
};

function tileToWorld(tx: number, ty: number) {
  return {
    x: (tx - MAP_W / 2) * CELL,
    z: (ty - MAP_H / 2) * CELL,
  };
}

function buildBuildings(): Building3[] {
  return CAMPUS_BUILDINGS.map((b) => {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.y0 + b.y1) / 2;
    const w = (b.x1 - b.x0 + 1) * CELL;
    const d = (b.y1 - b.y0 + 1) * CELL;
    const p = tileToWorld(cx, cz);
    return {
      id: b.id,
      name: b.name,
      x: p.x,
      z: p.z,
      w,
      d,
      h: b.id === "chingsheng" || b.id === "library" ? 8 : b.id === "palace" ? 6.5 : 5.5,
      color: b.color,
      roof: b.roof,
    };
  });
}

function buildNpcs(): Npc3[] {
  return createNpcs().map((n) => {
    const tx = n.x / TILE;
    const ty = n.y / TILE;
    const p = tileToWorld(tx, ty);
    return {
      id: n.id,
      name: n.name,
      x: p.x,
      z: p.z,
      lines: n.lines,
      questId: n.questId,
    };
  });
}

function buildEnemies(): Enemy3[] {
  return createEnemies().map((e) => {
    const p = tileToWorld(e.x / TILE, e.y / TILE);
    return {
      id: e.id,
      kind: e.kind,
      x: p.x,
      z: p.z,
      hp: e.hp,
      maxHp: e.maxHp,
      atk: e.atk,
      speed: e.speed * 0.035,
      xp: e.xp,
      gold: e.gold,
      dead: false,
      boss: e.boss,
      aggro: 0,
      hitFlash: 0,
      phase: e.phase ?? 1,
    };
  });
}

const SAVE_KEY = "tku-campus-3d-v1";

export type HudState = {
  phase: GamePhase;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  atk: number;
  def: number;
  gold: number;
  areaName: string | null;
  quests: Quest[];
  inventory: InventorySlot[];
  dialogue: { speaker: string; lines: string[]; index: number } | null;
  toast: string | null;
  interactHint: string | null;
  bossHp: { name: string; hp: number; maxHp: number } | null;
  flags: Record<string, boolean>;
  dashReady: boolean;
  playerPos: { x: number; z: number };
  stamps: string[];
  objective: { label: string; x: number; z: number } | null;
  companion: boolean;
};

type GameStore = {
  phase: GamePhase;
  tiles: Uint8Array;
  buildings: Building3[];
  npcs: Npc3[];
  enemies: Enemy3[];
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    level: number;
    xp: number;
    xpToNext: number;
    gold: number;
    invuln: number;
    attackCd: number;
    dashCd: number;
    facing: Dir;
  };
  inventory: InventorySlot[];
  quests: Quest[];
  flags: Record<string, boolean>;
  dialogue: { speaker: string; lines: string[]; index: number; onDone?: () => void } | null;
  toast: string | null;
  toastT: number;
  areaName: string | null;
  interactHint: string | null;
  stamps: string[];
  companion: { x: number; z: number; yaw: number } | null;
  objective: { label: string; x: number; z: number } | null;
  keys: Set<string>;
  touch: { x: number; y: number };
  look: number; // -1..1 camera turn from right stick / drag
  camYaw: number; // camera orbit yaw (movement is relative to this)
  attackQueued: boolean;
  interactQueued: boolean;
  dashQueued: boolean;
  muted: boolean;

  initNew: () => void;
  continueGame: () => void;
  hasSave: () => boolean;
  setPhase: (p: GamePhase) => void;
  setKey: (code: string, down: boolean) => void;
  setTouch: (x: number, y: number) => void;
  setLook: (v: number) => void;
  queueAttack: () => void;
  queueInteract: () => void;
  queueDash: () => void;
  tick: (dt: number) => void;
  advanceDialogue: () => void;
  useItem: (id: ItemId) => void;
  getHud: () => HudState;
  save: () => void;
};

function spawnPlayer() {
  const p = tileToWorld(12, 16);
  return {
    x: p.x,
    y: 0,
    z: p.z,
    yaw: 0,
    hp: playerMaxHpForLevel(1),
    maxHp: playerMaxHpForLevel(1),
    atk: playerAtkForLevel(1),
    def: playerDefForLevel(1),
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    gold: 0,
    invuln: 0,
    attackCd: 0,
    dashCd: 0,
    facing: "down" as Dir,
  };
}

function solidAt(tiles: Uint8Array, x: number, z: number): boolean {
  const tx = Math.floor(x / CELL + MAP_W / 2);
  const ty = Math.floor(z / CELL + MAP_H / 2);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return isSolidTile(tiles[ty * MAP_W + tx]!);
}

function areaFor(x: number, z: number): string {
  const tx = x / CELL + MAP_W / 2;
  if (tx >= 45) return "驚聲挑戰廣場";
  if (tx >= 35) return "體育館／活動中心";
  if (tx >= 18) return "書卷廣場";
  if (tx < 6) return "校門方向";
  return "宮燈大道";
}

export const useGame = create<GameStore>((set, get) => ({
  phase: "title",
  tiles: buildTileMap(),
  buildings: buildBuildings(),
  npcs: buildNpcs(),
  enemies: buildEnemies(),
  player: spawnPlayer(),
  inventory: [],
  quests: createInitialQuests(),
  flags: {},
  dialogue: null,
  toast: null,
  toastT: 0,
  areaName: "宮燈大道",
  interactHint: null,
  stamps: [],
  companion: null,
  objective: null,
  keys: new Set(),
  touch: { x: 0, y: 0 },
  look: 0,
  camYaw: 0,
  attackQueued: false,
  interactQueued: false,
  dashQueued: false,
  muted: false,

  initNew() {
    audio.unlock();
    audio.play("ui");
    set({
      phase: "playing",
      tiles: buildTileMap(),
      buildings: buildBuildings(),
      npcs: buildNpcs(),
      enemies: buildEnemies(),
      player: spawnPlayer(),
      inventory: [
        { id: "potion", count: 1 },
        { id: "herb", count: 2 },
      ],
      quests: createInitialQuests(),
      flags: {},
      dialogue: null,
      toast: "先找迎新總召小雨！左搖桿移動 · 右視角轉鏡頭",
      toastT: 4.5,
      areaName: "宮燈大道",
      interactHint: null,
      stamps: [],
      companion: null,
      camYaw: 0,
    });
    get().save();
  },

  continueGame() {
    audio.unlock();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        get().initNew();
        return;
      }
      const data = JSON.parse(raw);
      set({
        phase: "playing",
        player: { ...spawnPlayer(), ...data.player },
        inventory: data.inventory ?? [],
        quests: data.quests ?? createInitialQuests(),
        flags: data.flags ?? {},
        stamps: data.stamps ?? [],
        companion: data.flags?.companion
          ? { x: data.player?.x ?? 0, z: data.player?.z ?? 0, yaw: 0 }
          : null,
        enemies: (data.enemies ?? buildEnemies()).map((e: Enemy3) => ({
          ...e,
          hitFlash: 0,
          aggro: 0,
        })),
        toast: "繼續校園導覽",
        toastT: 2,
        dialogue: null,
      });
    } catch {
      get().initNew();
    }
  },

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  },

  setPhase(p) {
    set({ phase: p });
  },

  setKey(code, down) {
    const keys = new Set(get().keys);
    if (down) keys.add(code);
    else keys.delete(code);
    set({ keys });
  },

  setTouch(x, y) {
    set({ touch: { x, y } });
  },

  setLook(v) {
    set({ look: Math.max(-1, Math.min(1, v)) });
  },

  queueAttack() {
    set({ attackQueued: true });
  },
  queueInteract() {
    set({ interactQueued: true });
  },
  queueDash() {
    set({ dashQueued: true });
  },

  advanceDialogue() {
    const d = get().dialogue;
    if (!d) return;
    if (d.index + 1 < d.lines.length) {
      set({ dialogue: { ...d, index: d.index + 1 } });
      audio.play("ui");
      return;
    }
    const done = d.onDone;
    set({ dialogue: null, phase: get().phase === "dialogue" ? "playing" : get().phase });
    done?.();
  },

  useItem(id) {
    const inv = [...get().inventory];
    const slot = inv.find((s) => s.id === id);
    const def = ITEMS[id];
    if (!slot || !def?.heal) return;
    const p = { ...get().player };
    if (p.hp >= p.maxHp) {
      set({ toast: "體力已滿", toastT: 1.5 });
      return;
    }
    p.hp = Math.min(p.maxHp, p.hp + def.heal);
    slot.count -= 1;
    const next = inv.filter((s) => s.count > 0);
    set({
      player: p,
      inventory: next,
      toast: `使用了${def.name}`,
      toastT: 1.5,
    });
    audio.play("ui");
    get().save();
  },

  save() {
    const s = get();
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          player: s.player,
          inventory: s.inventory,
          quests: s.quests,
          flags: s.flags,
          stamps: s.stamps,
          enemies: s.enemies.map((e) => ({
            id: e.id,
            kind: e.kind,
            x: e.x,
            z: e.z,
            hp: e.hp,
            maxHp: e.maxHp,
            atk: e.atk,
            speed: e.speed,
            xp: e.xp,
            gold: e.gold,
            dead: e.dead,
            boss: e.boss,
            phase: e.phase,
          })),
        }),
      );
    } catch {
      /* ignore */
    }
  },

  getHud() {
    const s = get();
    const boss = s.enemies.find((e) => e.boss && !e.dead);
    const nearBoss =
      boss &&
      Math.hypot(boss.x - s.player.x, boss.z - s.player.z) < 18;
    return {
      phase: s.phase,
      level: s.player.level,
      hp: s.player.hp,
      maxHp: s.player.maxHp,
      xp: s.player.xp,
      xpToNext: s.player.xpToNext,
      atk: s.player.atk,
      def: s.player.def,
      gold: s.player.gold,
      areaName: s.areaName,
      quests: s.quests,
      inventory: s.inventory,
      dialogue: s.dialogue
        ? {
            speaker: s.dialogue.speaker,
            lines: s.dialogue.lines,
            index: s.dialogue.index,
          }
        : null,
      toast: s.toast,
      interactHint: s.interactHint,
      bossHp:
        boss && nearBoss
          ? { name: "迎新挑戰王 張哲維", hp: boss.hp, maxHp: boss.maxHp }
          : null,
      flags: s.flags,
      dashReady: s.player.dashCd <= 0,
      playerPos: { x: s.player.x, z: s.player.z },
      stamps: s.stamps,
      objective: s.objective,
      companion: !!(s.flags.companion || s.companion),
    };
  },

  tick(dt) {
    const s = get();
    if (s.phase !== "playing" && s.phase !== "dialogue") {
      if (s.toastT > 0) {
        const t = s.toastT - dt;
        set({ toastT: t, toast: t > 0 ? s.toast : null });
      }
      return;
    }

    let toast = s.toast;
    let toastT = s.toastT;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toast = null;
    }

    if (s.phase === "dialogue") {
      set({ toast, toastT });
      return;
    }

    const p = { ...s.player };
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);

    const keys = s.keys;
    let mx = 0;
    let mz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) mz -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) mz += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
    mx += s.touch.x;
    mz += s.touch.y;

    // Camera yaw: right-stick / drag (look), Q=left R=right (E reserved for talk)
    let camYaw = s.camYaw;
    let look = s.look;
    if (keys.has("KeyQ") || keys.has("Comma") || keys.has("BracketLeft")) look = Math.min(look, 0) - 1;
    if (keys.has("KeyR") || keys.has("Period") || keys.has("BracketRight")) look = Math.max(look, 0) + 1;
    look = Math.max(-1, Math.min(1, look));
    if (Math.abs(look) > 0.02) {
      camYaw -= look * 2.8 * dt;
    }

    // Movement relative to CAMERA (not body) — stick up = walk toward screen-up
    const len = Math.hypot(mx, mz);
    let moving = false;
    if (len > 0.08) {
      moving = true;
      const nx = mx / len;
      const nz = mz / len;
      const fy = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      // W/up (nz=-1) → camera forward; A/left (nx=-1) → camera left
      const fx = fy * -nz + rx * nx;
      const fz2 = fz * -nz + rz * nx;
      let speed = 14; // snappier campus walk
      const wantDash =
        s.dashQueued || keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyK");
      if (wantDash && p.dashCd <= 0) {
        speed = 22;
        p.dashCd = 1.1;
        audio.play("ui");
      }
      // diagonal already normalized via nx,nz
      const step = speed * dt;
      // try full, then slide on axes (less sticky walls)
      const tryX = p.x + fx * step;
      const tryZ = p.z + fz2 * step;
      const blockedX = solidAt(s.tiles, tryX, p.z) || buildingHit(s.buildings, tryX, p.z, 0.4);
      const blockedZ = solidAt(s.tiles, p.x, tryZ) || buildingHit(s.buildings, p.x, tryZ, 0.4);
      if (!blockedX && !solidAt(s.tiles, tryX, tryZ) && !buildingHit(s.buildings, tryX, tryZ, 0.4)) {
        p.x = tryX;
        p.z = tryZ;
      } else {
        if (!blockedX) p.x = tryX;
        if (!blockedZ) p.z = tryZ;
      }
      // character faces move direction
      if (Math.hypot(fx, fz2) > 0.01) {
        p.yaw = Math.atan2(-fx, -fz2);
      }
    }
    if (s.dashQueued) s.dashQueued = false;

    // interact — larger radius, easier to talk
    let interactHint: string | null = null;
    const nearNpc = s.npcs.find(
      (n) => Math.hypot(n.x - p.x, n.z - p.z) < 4.2,
    );
    if (nearNpc) interactHint = `點「談」或按 E · ${nearNpc.name}`;

    if (s.interactQueued) {
      s.interactQueued = false;
      if (nearNpc) {
        talkNpc(nearNpc, set, get);
      } else {
        set({ toast: "靠近人物再對話", toastT: 1.2 });
      }
    }

    // attack
    let enemies = s.enemies.map((e) => ({ ...e }));
    if ((s.attackQueued || keys.has("Space") || keys.has("KeyJ")) && p.attackCd <= 0) {
      s.attackQueued = false;
      p.attackCd = 0.35;
      audio.play("hit");
      const fy = -Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 3.4) continue;
        const dot = (dx * fy + dz * fz) / (dist || 1);
        if (dot < -0.15) continue; // allow side hits
        const dmg = Math.max(1, p.atk - (e.kind === "boss" ? 2 : 0));
        e.hp -= dmg;
        e.hitFlash = 0.2;
        e.aggro = 4;
        if (e.hp <= 0) {
          e.dead = true;
          e.hp = 0;
          p.gold += e.gold;
          p.xp += e.xp;
          // quests
          const quests = s.quests.map((q) => ({ ...q }));
          if (e.kind === "slime") {
            const q = quests.find((x) => x.id === "slime_hunt");
            if (q && q.status === "active") {
              q.progress = Math.min(q.goal, q.progress + 1);
              if (q.progress >= q.goal) q.status = "complete";
            }
          }
          if (e.boss) {
            const q = quests.find((x) => x.id === "shadow_king");
            if (q && q.status === "active") {
              /* wait for bainen */
            }
            set({
              flags: { ...get().flags, boss_dead: true },
              toast: "挑戰通過！快去找柏能學長",
              toastT: 3,
              quests,
            });
            audio.play("boss");
          } else {
            set({ quests });
          }
          while (p.xp >= p.xpToNext) {
            p.xp -= p.xpToNext;
            p.level += 1;
            p.maxHp = playerMaxHpForLevel(p.level);
            p.hp = p.maxHp;
            p.atk = playerAtkForLevel(p.level);
            p.def = playerDefForLevel(p.level);
            p.xpToNext = xpForLevel(p.level);
            toast = `等級提升！Lv.${p.level}`;
            toastT = 2;
          }
        } else if (e.boss && e.hp <= e.maxHp * 0.5 && e.phase < 2) {
          e.phase = 2;
          e.speed *= 1.35;
          toast = "張哲維開啟「期末狂暴模式」！";
          toastT = 2.5;
          audio.play("boss");
        }
      }
    } else {
      s.attackQueued = false;
    }

    // enemy AI
    for (const e of enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      const range = e.boss ? 16 : e.kind === "goblin" ? 11 : 9;
      if (dist < range) e.aggro = 3;
      else e.aggro = Math.max(0, e.aggro - dt);
      if (e.aggro > 0 && dist > 1.2) {
        const sp = e.speed * (e.phase >= 2 ? 1.2 : 1);
        const nx = e.x + (dx / dist) * sp * dt;
        const nz = e.z + (dz / dist) * sp * dt;
        if (!solidAt(s.tiles, nx, e.z) && !buildingHit(s.buildings, nx, e.z, 0.5)) e.x = nx;
        if (!solidAt(s.tiles, e.x, nz) && !buildingHit(s.buildings, e.x, nz, 0.5)) e.z = nz;
      }
      if (dist < 1.15 && p.invuln <= 0) {
        const dmg = Math.max(1, e.atk - p.def);
        p.hp -= dmg;
        p.invuln = 0.9;
        audio.play("hurt");
        if (p.hp <= 0) {
          p.hp = 0;
          set({
            player: p,
            enemies,
            phase: "dead",
            toast: null,
            toastT: 0,
          });
          return;
        }
      }
    }

    // ensure boss flag if boss already dead in state
    let flags = s.flags;
    const bossE = enemies.find((e) => e.boss);
    if (bossE?.dead && !flags.boss_dead) {
      flags = { ...flags, boss_dead: true };
      toast = toast ?? "挑戰通過！快去找柏能學長";
      toastT = Math.max(toastT, 3);
    }

    const areaName = areaFor(p.x, p.z);

    // companion follow
    let companion = s.companion;
    if (s.flags.companion) {
      const cx = companion?.x ?? p.x - 1.2;
      const cz = companion?.z ?? p.z + 1.0;
      const dx = p.x - 1.1 - cx;
      const dz = p.z + 0.9 - cz;
      const d = Math.hypot(dx, dz);
      let nx = cx;
      let nz = cz;
      let cyaw = companion?.yaw ?? 0;
      if (d > 0.35) {
        const sp = Math.min(d * 3.2, 12) * dt;
        nx += (dx / d) * sp;
        nz += (dz / d) * sp;
        cyaw = Math.atan2(-dx / d, -dz / d);
      }
      companion = { x: nx, z: nz, yaw: cyaw };
    } else {
      companion = null;
    }

    const objective = computeObjective({
      ...s,
      player: p,
      enemies,
      stamps: s.stamps,
      flags: s.flags,
      quests: s.quests,
      npcs: s.npcs,
    } as GameStore);

    set({
      player: p,
      enemies,
      toast,
      toastT,
      areaName,
      interactHint,
      camYaw,
      companion,
      objective,
      flags,
      attackQueued: false,
      interactQueued: false,
      dashQueued: false,
    });

    // autosave throttle via toast markers
    if (moving && Math.random() < 0.01) get().save();
  },
}));

function buildingHit(buildings: Building3[], x: number, z: number, r: number) {
  for (const b of buildings) {
    const hx = b.w / 2 - 0.15;
    const hz = b.d / 2 - 0.15;
    if (Math.abs(x - b.x) < hx + r && Math.abs(z - b.z) < hz + r) return true;
  }
  return false;
}

function talkNpc(
  npc: Npc3,
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  audio.play("ui");
  const s = get();

  if (npc.id === "elder") {
    const quests = s.quests.map((q) => ({ ...q }));
    const q = quests.find((x) => x.id === "shadow_king")!;
    if (q.status === "inactive") {
      q.status = "active";
      const stampsQ = quests.find((x) => x.id === "campus_stamps");
      if (stampsQ && stampsQ.status === "inactive") stampsQ.status = "active";
      set({
        quests,
        phase: "dialogue",
        dialogue: {
          speaker: npc.name,
          lines: npc.lines[0]!,
          index: 0,
          onDone: () => {
            set({ toast: "新任務：迎新闖關 · 沿路收集新生戳章", toastT: 3 });
            get().save();
          },
        },
      });
      return;
    }
    if (q.status === "complete" || s.flags.princess_rescued || s.flags.game_won) {
      set({
        phase: "dialogue",
        dialogue: {
          speaker: npc.name,
          lines: npc.lines[2]!,
          index: 0,
          onDone: () => {
            q.status = "turned_in";
            set({
              quests,
              flags: { ...get().flags, game_won: true, princess_rescued: true },
              phase: "victory",
            });
            audio.play("win");
            get().save();
          },
        },
      });
      return;
    }
    set({
      phase: "dialogue",
      dialogue: { speaker: npc.name, lines: npc.lines[1]!, index: 0 },
    });
    return;
  }

  if (npc.id === "merchant") {
    const quests = s.quests.map((q) => ({ ...q }));
    const q = quests.find((x) => x.id === "slime_hunt")!;
    if (q.status === "inactive") {
      q.status = "active";
      set({
        quests,
        phase: "dialogue",
        dialogue: {
          speaker: npc.name,
          lines: npc.lines[0]!,
          index: 0,
          onDone: () => set({ toast: "新任務：清理迷航史萊姆", toastT: 2.5 }),
        },
      });
      return;
    }
    if (q.status === "complete") {
      set({
        phase: "dialogue",
        dialogue: {
          speaker: npc.name,
          lines: npc.lines[2]!,
          index: 0,
          onDone: () => {
            q.status = "turned_in";
            const inv = [...get().inventory];
            const slot = inv.find((i) => i.id === "potion");
            if (slot) slot.count += 1;
            else inv.push({ id: "potion", count: 1 });
            const p = { ...get().player, gold: get().player.gold + 30 };
            set({ quests, inventory: inv, player: p, toast: "獲得提神飲料", toastT: 2 });
            get().save();
          },
        },
      });
      return;
    }
    set({
      phase: "dialogue",
      dialogue: {
        speaker: npc.name,
        lines: q.status === "turned_in" ? ["史萊姆少多了，學餐門口清靜不少！"] : npc.lines[1]!,
        index: 0,
      },
    });
    return;
  }

  if (npc.id === "bainen") {
    if (!s.flags.boss_dead) {
      set({
        phase: "dialogue",
        dialogue: { speaker: npc.name, lines: npc.lines[0]!, index: 0 },
      });
      return;
    }
    if (!s.flags.princess_rescued) {
      set({
        phase: "dialogue",
        dialogue: {
          speaker: npc.name,
          lines: npc.lines[1]!,
          index: 0,
          onDone: () => {
            const quests = get().quests.map((q) => ({ ...q }));
            const q = quests.find((x) => x.id === "shadow_king");
            if (q) {
              q.status = "complete";
              q.progress = 1;
            }
            const inv = [...get().inventory];
            if (!inv.find((i) => i.id === "anjie_token")) {
              inv.push({ id: "anjie_token", count: 1 });
            }
            const pp = get().player;
            set({
              quests,
              inventory: inv,
              flags: {
                ...get().flags,
                princess_rescued: true,
                companion: true,
              },
              companion: { x: pp.x - 1.2, z: pp.z + 1, yaw: pp.yaw },
              phase: "playing",
              toast: "找到柏能學長！一起回宮燈大道找小雨回報",
              toastT: 4,
            });
            audio.play("ui");
            get().save();
          },
        },
      });
      return;
    }
    set({
      phase: "dialogue",
      dialogue: { speaker: npc.name, lines: npc.lines[2]!, index: 0 },
    });
    return;
  }

  // stamp NPCs + default dialogue
  const isStamp = (STAMP_NPC_IDS as readonly string[]).includes(npc.id);
  set({
    phase: "dialogue",
    dialogue: {
      speaker: npc.name,
      lines: npc.lines[0] ?? ["……"],
      index: 0,
      onDone: isStamp
        ? () => {
            grantStamp(npc.id, set, get);
          }
        : undefined,
    },
  });
}

function grantStamp(
  npcId: string,
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  const s = get();
  if (s.stamps.includes(npcId)) {
    set({ toast: `已蓋過「${STAMP_LABELS[npcId] ?? npcId}」戳章`, toastT: 1.5 });
    return;
  }
  const stamps = [...s.stamps, npcId];
  const quests = s.quests.map((q) => ({ ...q }));
  const q = quests.find((x) => x.id === "campus_stamps");
  if (q) {
    if (q.status === "inactive") q.status = "active";
    q.progress = Math.min(q.goal, stamps.length);
    if (q.progress >= q.goal) q.status = "complete";
  }
  const label = STAMP_LABELS[npcId] ?? npcId;
  set({
    stamps,
    quests,
    toast:
      stamps.length >= 5
        ? "新生戳章集滿！可去驚聲廣場挑戰，或回小雨處"
        : `獲得戳章：${label}（${stamps.length}/5）`,
    toastT: 2.8,
  });
  audio.play("ui");
  get().save();
}

function computeObjective(s: GameStore): { label: string; x: number; z: number } | null {
  const main = s.quests.find((q) => q.id === "shadow_king");
  const stampsQ = s.quests.find((q) => q.id === "campus_stamps");
  const slimeQ = s.quests.find((q) => q.id === "slime_hunt");
  const npc = (id: string) => s.npcs.find((n) => n.id === id);
  if (!main || main.status === "inactive") {
    const e = npc("elder");
    return e ? { label: "找迎新總召小雨", x: e.x, z: e.z } : null;
  }
  if (s.flags.princess_rescued && main.status === "complete") {
    const e = npc("elder");
    return e ? { label: "回宮燈大道找小雨回報", x: e.x, z: e.z } : null;
  }
  if (s.flags.boss_dead) {
    const b = npc("bainen");
    return b ? { label: "與柏能學長對話", x: b.x, z: b.z } : null;
  }
  if (main.status === "active") {
    // prefer stamps if few
    if (stampsQ && stampsQ.status === "active" && stampsQ.progress < 3) {
      const nextId = STAMP_NPC_IDS.find((id) => !s.stamps.includes(id));
      const n = nextId ? npc(nextId) : null;
      if (n) return { label: `收集戳章：${STAMP_LABELS[nextId!] ?? ""}`, x: n.x, z: n.z };
    }
    if (slimeQ && slimeQ.status === "active" && slimeQ.progress < slimeQ.goal) {
      return { label: "清理迷航史萊姆", x: s.player.x + 8, z: s.player.z };
    }
    const boss = s.enemies.find((e) => e.boss && !e.dead);
    if (boss) return { label: "驚聲廣場 · 迎新挑戰", x: boss.x, z: boss.z };
    const b = npc("bainen");
    return b ? { label: "前往驚聲廣場", x: b.x, z: b.z } : null;
  }
  return null;
}

