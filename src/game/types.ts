export type Dir = "down" | "up" | "left" | "right";

export type GamePhase = "title" | "playing" | "dialogue" | "inventory" | "dead" | "victory" | "paused";

export type ItemId = "potion" | "herb" | "key" | "anjie_token";

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  heal?: number;
  quest?: boolean;
}

export interface InventorySlot {
  id: ItemId;
  count: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Dir;
  moving: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  invuln: number;
  attackTimer: number;
  attackCooldown: number;
  dashCd: number;
  anim: number;
  facing: Dir;
}

export interface Enemy {
  id: string;
  kind: "slime" | "goblin" | "boss";
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  radius: number;
  xp: number;
  gold: number;
  anim: number;
  hitFlash: number;
  knockbackX: number;
  knockbackY: number;
  aggro: number;
  dead: boolean;
  boss?: boolean;
  phase?: number;
  atkCd?: number;
}

export interface Npc {
  id: string;
  name: string;
  x: number;
  y: number;
  anim: number;
  lines: string[][];
  questId?: string;
}

export interface Prop {
  id: string;
  kind: "tree" | "rock" | "chest" | "sign" | "house";
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  opened?: boolean;
  loot?: { gold?: number; item?: ItemId; count?: number };
  signText?: string;
}

export interface SlashFx {
  x: number;
  y: number;
  dir: Dir;
  t: number;
  life: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Quest {
  id: string;
  title: string;
  desc: string;
  status: "inactive" | "active" | "complete" | "turned_in";
  target: string;
  progress: number;
  goal: number;
}

export interface SaveData {
  version: 1;
  player: PlayerState;
  inventory: InventorySlot[];
  quests: Quest[];
  enemies: Array<Pick<Enemy, "id" | "hp" | "dead" | "x" | "y">>;
  props: Array<{ id: string; opened?: boolean }>;
  flags: Record<string, boolean>;
}

export interface HudSnapshot {
  phase: GamePhase;
  player: PlayerState;
  inventory: InventorySlot[];
  quests: Quest[];
  dialogue: { speaker: string; lines: string[]; index: number } | null;
  toast: string | null;
  interactHint: string | null;
  bossHp: { name: string; hp: number; maxHp: number } | null;
  flags: Record<string, boolean>;
  areaName: string | null;
  dashCd: number;
  dashMax: number;
  minimap: {
    w: number;
    h: number;
    player: { x: number; y: number };
    boss: { x: number; y: number } | null;
    princess: { x: number; y: number } | null;
    npcs: Array<{ x: number; y: number; quest?: boolean }>;
  };
}
