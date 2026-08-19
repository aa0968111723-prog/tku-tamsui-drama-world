import { AssetBank } from "./assets";
import { audio } from "./audio";
import {
  TILE,
  MAP_W,
  MAP_H,
  WORLD_W,
  WORLD_H,
  ITEMS,
  CAMPUS_BUILDINGS,
  buildTileMap,
  isSolidTile,
  createInitialQuests,
  createNpcs,
  createProps,
  createEnemies,
  xpForLevel,
  playerAtkForLevel,
  playerDefForLevel,
  playerMaxHpForLevel,
} from "./data";
import type {
  Dir,
  Enemy,
  FloatText,
  GamePhase,
  HudSnapshot,
  InventorySlot,
  ItemId,
  Npc,
  Particle,
  PlayerState,
  Prop,
  Quest,
  SaveData,
  SlashFx,
} from "./types";

const SAVE_KEY = "tku-freshman-orient-v1";
const FIXED_DT = 1 / 60;

type CompanionState = {
  x: number;
  y: number;
  anim: number;
  atkCd: number;
  facing: Dir;
};

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  assets = new AssetBank();

  phase: GamePhase = "title";
  tiles = buildTileMap();
  player!: PlayerState;
  inventory: InventorySlot[] = [];
  quests: Quest[] = [];
  npcs: Npc[] = [];
  props: Prop[] = [];
  enemies: Enemy[] = [];
  slashes: SlashFx[] = [];
  floats: FloatText[] = [];
  particles: Particle[] = [];
  flags: Record<string, boolean> = {};
  companionJoined = false;
  companion: CompanionState = {
    x: 0,
    y: 0,
    anim: 0,
    atkCd: 0,
    facing: "down",
  };

  keys = new Set<string>();
  touchMove = { x: 0, y: 0 };
  touchAttack = false;
  touchInteract = false;

  camX = 0;
  camY = 0;
  shake = 0;
  hitStop = 0;
  animTime = 0;
  toast: string | null = null;
  toastT = 0;
  dialogue: {
    speaker: string;
    lines: string[];
    index: number;
    onDone?: () => void;
  } | null = null;
  interactHint: string | null = null;
  lastTs = 0;
  acc = 0;
  running = false;
  raf = 0;
  dpr = 1;
  viewW = 800;
  viewH = 450;
  hudListeners = new Set<(s: HudSnapshot) => void>();
  saveTimer = 0;
  trauma = 0;
  areaName: string | null = null;
  lastArea = "";
  stepTimer = 0;
  ambientTimer = 0;
  dashMax = 1.6;
  camLookX = 0;
  camLookY = 0;
  hudTick = 0;
  vignetteCache: CanvasGradient | null = null;
  vignetteKey = "";
  maxParticles = 120;
  bossChargeT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.resetWorld(true);
  }

  async init() {
    await this.assets.load();
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.emitHud();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  subscribeHud(fn: (s: HudSnapshot) => void) {
    this.hudListeners.add(fn);
    fn(this.snapshot());
    return () => this.hudListeners.delete(fn);
  }

  emitHud() {
    const snap = this.snapshot();
    for (const fn of this.hudListeners) fn(snap);
  }

  snapshot(): HudSnapshot {
    const boss = this.enemies.find((e) => e.boss && !e.dead);
    const nearBoss =
      !!boss &&
      (boss.aggro > 0 ||
        Math.hypot(boss.x - this.player.x, boss.y - this.player.y) < 260);
    const princess = this.npcs.find((n) => n.id === "bainen");
    return {
      phase: this.phase,
      player: { ...this.player },
      inventory: this.inventory.map((s) => ({ ...s })),
      quests: this.quests.map((q) => ({ ...q })),
      dialogue: this.dialogue
        ? {
            speaker: this.dialogue.speaker,
            lines: this.dialogue.lines,
            index: this.dialogue.index,
          }
        : null,
      toast: this.toast,
      interactHint: this.interactHint,
      bossHp:
        boss && nearBoss
          ? { name: "迎新挑戰王 張哲維", hp: boss.hp, maxHp: boss.maxHp }
          : null,
      flags: { ...this.flags },
      areaName: this.areaName,
      dashCd: this.player.dashCd,
      dashMax: this.dashMax,
      minimap: {
        w: MAP_W,
        h: MAP_H,
        player: { x: this.player.x / TILE, y: this.player.y / TILE },
        boss: boss ? { x: boss.x / TILE, y: boss.y / TILE } : null,
        princess: princess
          ? { x: princess.x / TILE, y: princess.y / TILE }
          : null,
        npcs: this.npcs
          .filter((n) => n.id !== "bainen" || !this.companionJoined)
          .map((n) => ({
            x: n.x / TILE,
            y: n.y / TILE,
            quest: !!(
              n.questId &&
              this.quests.find(
                (q) =>
                  q.id === n.questId &&
                  (q.status === "inactive" || q.status === "complete"),
              )
            ),
          })),
      },
    };
  }

  resize = () => {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? window.innerWidth;
    const h = parent?.clientHeight ?? window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = Math.max(320, w);
    this.viewH = Math.max(240, h);
    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.centerCam(true);
  };

  onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === "Escape") {
      if (this.phase === "playing") this.setPhase("paused");
      else if (this.phase === "paused") this.setPhase("playing");
      else if (this.phase === "inventory") this.setPhase("playing");
      e.preventDefault();
    }
    if (e.code === "KeyI" && (this.phase === "playing" || this.phase === "inventory")) {
      this.setPhase(this.phase === "inventory" ? "playing" : "inventory");
      e.preventDefault();
    }
    if (
      (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") &&
      this.phase === "dialogue"
    ) {
      this.advanceDialogue();
      e.preventDefault();
    }
    if (e.code === "Digit1") this.useItem("potion");
    if (e.code === "Digit2") this.useItem("herb");
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyK") && this.phase === "playing") {
      this.tryDash();
      e.preventDefault();
    }
  };

  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  onBlur = () => {
    this.keys.clear();
    this.touchMove = { x: 0, y: 0 };
  };

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.acc += dt;
      while (this.acc >= FIXED_DT) {
        this.update(FIXED_DT);
        this.acc -= FIXED_DT;
      }
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPhase(phase: GamePhase) {
    this.phase = phase;
    this.emitHud();
  }

  startNewGame() {
    audio.unlock();
    audio.play("ui");
    this.resetWorld(false);
    this.phase = "playing";
    this.showToast("先找迎新總召小雨，開始校園導覽");
    this.save();
    this.emitHud();
  }

  continueGame() {
    audio.unlock();
    audio.play("ui");
    if (!this.load()) {
      this.startNewGame();
      return;
    }
    this.phase = "playing";
    this.showToast("繼續校園導覽");
    this.emitHud();
  }

  resetWorld(keepPhase: boolean) {
    this.tiles = buildTileMap();
    this.player = {
      x: 12 * TILE + 24,
      y: 16 * TILE + 24,
      vx: 0,
      vy: 0,
      dir: "down",
      facing: "down",
      moving: false,
      hp: playerMaxHpForLevel(1),
      maxHp: playerMaxHpForLevel(1),
      atk: playerAtkForLevel(1),
      def: playerDefForLevel(1),
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      gold: 0,
      invuln: 0,
      attackTimer: 0,
      attackCooldown: 0,
      dashCd: 0,
      anim: 0,
    };
    this.inventory = [
      { id: "potion", count: 1 },
      { id: "herb", count: 2 },
    ];
    this.quests = createInitialQuests();
    this.npcs = createNpcs();
    this.props = createProps();
    this.enemies = createEnemies();
    this.slashes = [];
    this.floats = [];
    this.particles = [];
    this.flags = {};
    this.companionJoined = false;
    this.companion = {
      x: 49 * TILE + 24,
      y: 14 * TILE + 24,
      anim: 0,
      atkCd: 0,
      facing: "down",
    };
    this.dialogue = null;
    this.toast = null;
    this.interactHint = null;
    this.shake = 0;
    this.hitStop = 0;
    this.saveTimer = 0;
    if (!keepPhase) this.phase = "title";
    this.centerCam(true);
  }

  save() {
    const data: SaveData & { companionJoined?: boolean } = {
      version: 1,
      player: this.player,
      inventory: this.inventory,
      quests: this.quests,
      enemies: this.enemies.map((e) => ({
        id: e.id,
        hp: e.hp,
        dead: e.dead,
        x: e.x,
        y: e.y,
      })),
      props: this.props.map((p) => ({ id: p.id, opened: p.opened })),
      flags: { ...this.flags, companion: this.companionJoined },
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1) return false;
      this.resetWorld(true);
      this.player = { ...this.player, ...data.player, dashCd: data.player.dashCd ?? 0 };
      this.inventory = data.inventory ?? [];
      this.quests = data.quests ?? createInitialQuests();
      this.flags = data.flags ?? {};
      this.companionJoined = !!this.flags.companion;
      if (this.companionJoined) {
        this.companion.x = this.player.x - 28;
        this.companion.y = this.player.y;
      }
      for (const pe of data.enemies ?? []) {
        const e = this.enemies.find((x) => x.id === pe.id);
        if (!e) continue;
        e.hp = pe.hp;
        e.dead = pe.dead;
        e.x = pe.x;
        e.y = pe.y;
      }
      for (const pp of data.props ?? []) {
        const p = this.props.find((x) => x.id === pp.id);
        if (p && pp.opened) p.opened = true;
      }
      this.centerCam(true);
      return true;
    } catch {
      return false;
    }
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  showToast(msg: string) {
    this.toast = msg;
    this.toastT = 2.4;
    this.emitHud();
  }

  update(dt: number) {
    this.animTime += dt;
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) {
        this.toast = null;
        this.emitHud();
      }
    }
    if (this.areaNameT > 0) {
      this.areaNameT -= dt;
      if (this.areaNameT <= 0) {
        this.areaName = null;
        this.emitHud();
      }
    }

    if (this.phase === "title" || this.phase === "dead" || this.phase === "victory") {
      return;
    }
    if (this.phase === "dialogue" || this.phase === "inventory" || this.phase === "paused") {
      for (const n of this.npcs) n.anim += dt * 2;
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      this.shake = this.trauma * this.trauma;
    }
    this.updatePlayer(dt);
    this.updateCompanion(dt);
    this.updateEnemies(dt);
    this.updateFx(dt);
    this.updateAmbient(dt);
    this.updateInteractHint();
    this.centerCam(false);

    this.hudTick += dt;
    if (this.hudTick >= 0.08) {
      this.hudTick = 0;
      this.emitHud();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 15) {
      this.saveTimer = 0;
      this.save();
    }
  }

  updatePlayer(dt: number) {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.attackTimer > 0) p.attackTimer -= dt;
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);

    let mx = 0;
    let my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    mx += this.touchMove.x;
    my += this.touchMove.y;

    const len = Math.hypot(mx, my);
    if (len > 0.15) {
      mx /= len;
      my /= len;
      p.moving = true;
      if (Math.abs(mx) > Math.abs(my)) p.facing = mx < 0 ? "left" : "right";
      else p.facing = my < 0 ? "up" : "down";
      p.dir = p.facing;
      // ~10 fps walk cycle over 4 frames
      const prevFrame = Math.floor(p.anim) % 4;
      p.anim += dt * 10;
      const frame = Math.floor(p.anim) % 4;
      // foot plant dust on contact frames (0 and 2)
      if (frame !== prevFrame && (frame === 0 || frame === 2)) {
        this.burst(p.x + (p.facing === "left" ? -4 : p.facing === "right" ? 4 : 0), p.y + 12, "rgba(210,190,140,0.55)", 3);
        audio.play("step");
      }
      this.camLookX += (mx * 52 - this.camLookX) * (1 - Math.exp(-4 * dt));
      this.camLookY += (my * 40 - this.camLookY) * (1 - Math.exp(-4 * dt));
    } else {
      p.moving = false;
      mx = 0;
      my = 0;
      // gentle idle breathe
      p.anim += dt * 2.4;
      this.camLookX += (0 - this.camLookX) * (1 - Math.exp(-3 * dt));
      this.camLookY += (0 - this.camLookY) * (1 - Math.exp(-3 * dt));
    }

    const speed = 158;
    this.moveEntity(p, mx * speed * dt, my * speed * dt, 14);
    this.updateAreaName();

    if (
      (this.keys.has("Space") || this.keys.has("KeyJ") || this.touchAttack) &&
      p.attackCooldown <= 0
    ) {
      this.tryAttack();
      this.touchAttack = false;
    }
    if (this.keys.has("KeyE") || this.touchInteract) {
      this.tryInteract();
      this.touchInteract = false;
      this.keys.delete("KeyE");
    }

    for (const e of this.enemies) {
      if (e.dead || p.invuln > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < e.radius + 12) {
        this.hurtPlayer(e.atk, e.x, e.y);
      }
    }
  }

  tryDash() {
    if (this.phase !== "playing") return;
    const p = this.player;
    if (p.dashCd > 0) return;
    let mx = 0;
    let my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    mx += this.touchMove.x;
    my += this.touchMove.y;
    if (Math.hypot(mx, my) < 0.1) {
      if (p.facing === "up") my = -1;
      else if (p.facing === "down") my = 1;
      else if (p.facing === "left") mx = -1;
      else mx = 1;
    }
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
    this.moveEntity(p, mx * 72, my * 72, 14);
    p.dashCd = this.dashMax;
    p.invuln = Math.max(p.invuln, 0.22);
    this.burst(p.x, p.y, "#9dffa8", 12);
    this.addTrauma(0.18);
    audio.play("dash");
    this.emitHud();
  }

  areaNameT = 0;

  updateAreaName() {
    const tx = Math.floor(this.player.x / TILE);
    let name = "宮燈大道";
    if (tx >= 45) name = "驚聲挑戰廣場";
    else if (tx >= 35) name = "體育館／活動中心";
    else if (tx >= 18) name = "書卷廣場";
    else if (tx < 6) name = "校門方向";
    if (name !== this.lastArea) {
      this.lastArea = name;
      this.areaName = name;
      this.areaNameT = 1.8;
      this.emitHud();
    }
  }

  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  updateCompanion(dt: number) {
    if (!this.companionJoined) return;
    const c = this.companion;
    const p = this.player;
    const offset = 36;
    let tx = p.x;
    let ty = p.y;
    if (p.facing === "down") ty -= offset;
    else if (p.facing === "up") ty += offset;
    else if (p.facing === "left") tx += offset;
    else tx -= offset;

    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      const speed = dist > 120 ? 220 : 130;
      c.x += (dx / dist) * speed * dt;
      c.y += (dy / dist) * speed * dt;
      c.anim += dt * 10;
      if (Math.abs(dx) > Math.abs(dy)) c.facing = dx < 0 ? "left" : "right";
      else c.facing = dy < 0 ? "up" : "down";
    }

    if (c.atkCd > 0) c.atkCd -= dt;
    if (c.atkCd <= 0) {
      let nearest: Enemy | null = null;
      let best = 72;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d < best) {
          best = d;
          nearest = e;
        }
      }
      if (nearest) {
        c.atkCd = 0.9;
        this.damageEnemy(
          nearest,
          Math.max(4, Math.floor(this.player.atk * 0.45)),
          c.x,
          c.y,
        );
        this.burst(nearest.x, nearest.y, "#7eb6ff", 6);
      }
    }
  }

  moveEntity(
    ent: { x: number; y: number },
    dx: number,
    dy: number,
    radius: number,
  ) {
    const tryMove = (mx: number, my: number) => {
      const nx = ent.x + mx;
      const ny = ent.y + my;
      if (!this.collides(nx, ny, radius)) {
        ent.x = nx;
        ent.y = ny;
        return true;
      }
      return false;
    };
    if (!tryMove(dx, dy)) {
      if (!tryMove(dx, 0)) tryMove(0, dy);
    }
    ent.x = Math.max(radius, Math.min(WORLD_W - radius, ent.x));
    ent.y = Math.max(radius, Math.min(WORLD_H - radius, ent.y));
  }

  collides(x: number, y: number, radius: number): boolean {
    const points = [
      [x - radius, y - radius * 0.4],
      [x + radius, y - radius * 0.4],
      [x - radius, y + radius * 0.5],
      [x + radius, y + radius * 0.5],
    ];
    for (const [px, py] of points) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
      if (isSolidTile(this.tiles[ty * MAP_W + tx]!)) return true;
    }
    for (const prop of this.props) {
      if (!prop.solid) continue;
      if (
        Math.abs(x - prop.x) < prop.w * 0.4 + radius * 0.5 &&
        Math.abs(y - prop.y) < prop.h * 0.35 + radius * 0.4
      ) {
        return true;
      }
    }
    return false;
  }

  tryAttack() {
    if (this.phase !== "playing") return;
    const p = this.player;
    if (p.attackCooldown > 0) return;
    p.attackCooldown = 0.34;
    p.attackTimer = 0.18;
    audio.play("slash");
    const reach = 46;
    let ax = p.x;
    let ay = p.y;
    if (p.facing === "up") ay -= reach * 0.6;
    if (p.facing === "down") ay += reach * 0.5;
    if (p.facing === "left") ax -= reach * 0.7;
    if (p.facing === "right") ax += reach * 0.7;
    this.slashes.push({
      x: ax,
      y: ay,
      dir: p.facing,
      t: 0,
      life: 0.22,
    });
    // attack lunge
    let lx = 0, ly = 0;
    if (p.facing === "up") ly = -18;
    else if (p.facing === "down") ly = 18;
    else if (p.facing === "left") lx = -18;
    else lx = 18;
    this.moveEntity(p, lx, ly, 14);
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - ax, e.y - ay);
      if (d < e.radius + 30) {
        const crit = Math.random() < 0.12 + p.level * 0.01;
        const dmg = crit ? Math.floor(p.atk * 1.75) : p.atk;
        this.damageEnemy(e, dmg, p.x, p.y, crit);
        hit = true;
      }
    }
    if (hit) audio.play("hit");
  }

  queueAttack() {
    this.touchAttack = true;
  }

  queueInteract() {
    this.touchInteract = true;
  }

  damageEnemy(e: Enemy, dmg: number, fromX: number, fromY: number, crit = false) {
    if (e.dead) return;
    const final = Math.max(1, dmg - (e.kind === "boss" ? 2 : 0));
    e.hp -= final;
    e.hitFlash = crit ? 0.18 : 0.12;
    e.aggro = 5;
    const ang = Math.atan2(e.y - fromY, e.x - fromX);
    const kb = crit ? 170 : 130;
    e.knockbackX = Math.cos(ang) * kb;
    e.knockbackY = Math.sin(ang) * kb;
    this.addFloat(e.x, e.y - 20, crit ? `暴擊 -${final}` : `-${final}`, crit ? "#ff9f43" : "#ffd36b");
    this.burst(e.x, e.y, e.kind === "boss" ? "#a66bff" : crit ? "#ff9f43" : "#7dffa0", crit ? 16 : 10);
    this.addTrauma(crit ? 0.35 : e.boss ? 0.28 : 0.18);
    this.hitStop = crit ? 0.07 : 0.045;
    // boss phase transition
    if (e.boss && e.hp > 0 && e.hp <= e.maxHp * 0.5 && (e.phase ?? 1) < 2) {
      e.phase = 2;
      e.speed = 72;
      e.atk = 20;
      this.showToast("張哲維開啟「期末狂暴模式」！");
      audio.play("boss");
      this.addTrauma(0.55);
      this.burst(e.x, e.y, "#c77dff", 28);
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
      this.onEnemyKilled(e);
    }
  }

  onEnemyKilled(e: Enemy) {
    this.player.gold += e.gold;
    this.gainXp(e.xp);
    this.burst(e.x, e.y, "#f5d76e", 18);
    this.addTrauma(e.boss ? 0.7 : 0.25);
    audio.play(e.boss ? "boss" : "hit");
    if (e.boss) {
      this.addItem("anjie_token", 1);
      this.flags.boss_dead = true;
      this.showToast("挑戰通過！快去找柏能學長");
      const q = this.quests.find((x) => x.id === "shadow_king");
      if (q && q.status === "active") {
        q.progress = 1;
        q.status = "complete";
      }
    }
    if (e.kind === "slime") {
      const q = this.quests.find((x) => x.id === "slime_hunt");
      if (q && q.status === "active") {
        q.progress = Math.min(q.goal, q.progress + 1);
        if (q.progress >= q.goal) q.status = "complete";
      }
    }
    this.save();
    this.emitHud();
  }

  gainXp(amount: number) {
    const p = this.player;
    p.xp += amount;
    this.addFloat(p.x, p.y - 40, `+${amount} XP`, "#9dffa8");
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = xpForLevel(p.level);
      p.maxHp = playerMaxHpForLevel(p.level);
      p.hp = p.maxHp;
      p.atk = playerAtkForLevel(p.level);
      p.def = playerDefForLevel(p.level);
      this.showToast(`等級提升！Lv.${p.level}`);
      this.burst(p.x, p.y, "#7dffa0", 24);
      audio.play("levelup");
      this.addTrauma(0.3);
    }
    this.emitHud();
  }

  hurtPlayer(atk: number, fromX: number, fromY: number) {
    const p = this.player;
    if (p.invuln > 0) return;
    const dmg = Math.max(1, atk - p.def);
    p.hp -= dmg;
    p.invuln = 0.7;
    const ang = Math.atan2(p.y - fromY, p.x - fromX);
    this.moveEntity(p, Math.cos(ang) * 28, Math.sin(ang) * 28, 14);
    this.addFloat(p.x, p.y - 24, `-${dmg}`, "#ff6b6b");
    this.addTrauma(0.5);
    this.burst(p.x, p.y, "#ff6b6b", 12);
    audio.play("hurt");
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = "dead";
      this.save();
    }
    this.emitHud();
  }

  updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim += dt * (e.boss ? 3 : 4);
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.aggro > 0) e.aggro -= dt;

      if (e.knockbackX || e.knockbackY) {
        this.moveEntity(e, e.knockbackX * dt, e.knockbackY * dt, e.radius * 0.6);
        e.knockbackX *= Math.max(0, 1 - dt * 8);
        e.knockbackY *= Math.max(0, 1 - dt * 8);
        if (Math.hypot(e.knockbackX, e.knockbackY) < 8) {
          e.knockbackX = 0;
          e.knockbackY = 0;
        }
      }

      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      const aggroRange = e.boss ? 240 : e.kind === "goblin" ? 170 : 140;
      if (dist < aggroRange) e.aggro = Math.max(e.aggro, 2.5);

      // boss charge telegraphs
      if (e.boss && e.aggro > 0) {
        e.atkCd = (e.atkCd ?? 0) - dt;
        if ((e.atkCd ?? 0) <= 0 && dist < 200 && dist > 40) {
          e.atkCd = (e.phase ?? 1) >= 2 ? 1.6 : 2.4;
          e.phase = e.phase ?? 1;
          // store charge vector in knockback as impulse
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          const power = (e.phase ?? 1) >= 2 ? 320 : 240;
          e.knockbackX = Math.cos(ang) * power;
          e.knockbackY = Math.sin(ang) * power;
          this.burst(e.x, e.y, "#c77dff", 10);
          this.addFloat(e.x, e.y - 50, "衝刺！", "#e0c3ff");
        }
      }

      if (e.aggro > 0 && dist > 18) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        const spd = e.boss && Math.hypot(e.knockbackX, e.knockbackY) > 40
          ? e.speed * 0.3
          : e.speed;
        this.moveEntity(
          e,
          Math.cos(ang) * spd * dt,
          Math.sin(ang) * spd * dt,
          e.radius * 0.55,
        );
      } else if (e.aggro <= 0) {
        e.x += Math.sin(this.animTime * 0.8 + e.anim) * 8 * dt;
        e.y += Math.cos(this.animTime * 0.6 + e.anim) * 6 * dt;
      }
    }
  }

  updateFx(dt: number) {
    this.slashes = this.slashes.filter((s) => {
      s.t += dt;
      return s.t < s.life;
    });
    this.floats = this.floats.filter((f) => {
      f.t += dt;
      f.y -= 28 * dt;
      return f.t < f.life;
    });
    this.particles = this.particles.filter((pt) => {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 40 * dt;
      return pt.life > 0;
    });
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  updateInteractHint() {
    const prev = this.interactHint;
    const t = this.findInteractTarget();
    if (!t) this.interactHint = null;
    else if (t.type === "npc") this.interactHint = `按 E 與 ${t.npc.name} 對話`;
    else if (t.type === "chest") this.interactHint = "按 E 打開寶箱";
    else if (t.type === "sign") this.interactHint = "按 E 閱讀告示";
    if (prev !== this.interactHint) this.emitHud();
  }

  findInteractTarget():
    | { type: "npc"; npc: Npc }
    | { type: "chest"; prop: Prop }
    | { type: "sign"; prop: Prop }
    | null {
    const p = this.player;
    let best: ReturnType<GameEngine["findInteractTarget"]> = null;
    let bestD = 52;
    for (const n of this.npcs) {
      if (n.id === "bainen" && this.companionJoined) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = { type: "npc", npc: n };
      }
    }
    for (const prop of this.props) {
      if (prop.kind !== "chest" && prop.kind !== "sign") continue;
      const d = Math.hypot(prop.x - p.x, prop.y - p.y);
      if (d < bestD) {
        bestD = d;
        best =
          prop.kind === "chest"
            ? { type: "chest", prop }
            : { type: "sign", prop };
      }
    }
    return best;
  }

  tryInteract() {
    if (this.phase !== "playing") return;
    const t = this.findInteractTarget();
    if (!t) return;
    if (t.type === "npc") this.talkToNpc(t.npc);
    else if (t.type === "chest") this.openChest(t.prop);
    else if (t.type === "sign") {
      this.openDialogue("校園告示", [t.prop.signText ?? "……"]);
    }
  }

  talkToNpc(npc: Npc) {
    if (npc.id === "elder") {
      const q = this.quests.find((x) => x.id === "shadow_king")!;
      if (q.status === "inactive") {
        q.status = "active";
        this.openDialogue(npc.name, npc.lines[0]!, () => {
          this.showToast("新任務：迎新闖關 · 尋找柏能");
          this.save();
        });
        this.emitHud();
        return;
      }
      if (q.status === "complete" || this.hasItem("anjie_token") || this.flags.princess_rescued) {
        this.openDialogue(npc.name, npc.lines[2]!, () => {
          this.removeItem("anjie_token", 1);
          q.status = "turned_in";
          if (!this.flags.game_won) {
            this.player.gold += 150;
            this.gainXp(80);
          }
          this.flags.game_won = true;
          this.flags.princess_rescued = true;
          this.phase = "victory";
          audio.play("win");
          this.save();
          this.emitHud();
        });
        return;
      }
      this.openDialogue(npc.name, npc.lines[1]!);
      return;
    }

    if (npc.id === "merchant") {
      const q = this.quests.find((x) => x.id === "slime_hunt")!;
      if (q.status === "inactive") {
        q.status = "active";
        this.openDialogue(npc.name, npc.lines[0]!, () => {
          this.showToast("新任務：清理迷航史萊姆");
          this.save();
        });
        this.emitHud();
        return;
      }
      if (q.status === "complete") {
        this.openDialogue(npc.name, npc.lines[2]!, () => {
          q.status = "turned_in";
          this.addItem("potion", 1);
          this.player.gold += 30;
          this.gainXp(25);
          this.save();
          this.emitHud();
        });
        return;
      }
      if (q.status === "turned_in") {
        this.openDialogue(npc.name, ["史萊姆少多了，學餐門口清靜不少。記得吃飯喔！"]);
        return;
      }
      this.openDialogue(npc.name, npc.lines[1]!);
      return;
    }

    if (npc.id === "bainen") {
      if (!this.flags.boss_dead) {
        this.openDialogue(npc.name, npc.lines[0]!);
        return;
      }
      if (!this.flags.princess_rescued) {
        this.openDialogue(npc.name, npc.lines[1]!, () => {
          this.flags.princess_rescued = true;
          this.companionJoined = true;
          this.flags.companion = true;
          this.companion.x = npc.x;
          this.companion.y = npc.y;
          const q = this.quests.find((x) => x.id === "shadow_king");
          if (q) {
            q.status = "complete";
            q.progress = 1;
          }
          this.player.gold += 150;
          this.gainXp(80);
          this.flags.game_won = true;
          this.phase = "victory";
          this.showToast("找到柏能學長了！新生導覽完成");
          audio.play("win");
          this.addTrauma(0.4);
          this.save();
          this.emitHud();
        });
        return;
      }
      this.openDialogue(npc.name, npc.lines[2] ?? ["之後校園一起慢慢認識吧。"]);
      return;
    }

    this.openDialogue(npc.name, npc.lines[0] ?? ["……"]);
  }

  openChest(prop: Prop) {
    if (prop.opened) {
      this.showToast("補給箱是空的");
      return;
    }
    prop.opened = true;
    const loot = prop.loot;
    if (loot?.gold) {
      this.player.gold += loot.gold;
      this.addFloat(prop.x, prop.y - 20, `+${loot.gold}G`, "#f5d76e");
    }
    if (loot?.item) {
      this.addItem(loot.item, loot.count ?? 1);
      this.addFloat(prop.x, prop.y - 36, ITEMS[loot.item].name, "#9dffa8");
    }
    this.burst(prop.x, prop.y, "#ffd36b", 12);
    audio.play("pickup");
    this.showToast("打開了社團補給箱！");
    this.save();
    this.emitHud();
  }

  openDialogue(speaker: string, lines: string[], onDone?: () => void) {
    this.phase = "dialogue";
    this.dialogue = { speaker, lines, index: 0, onDone };
    this.emitHud();
  }

  advanceDialogue() {
    if (!this.dialogue) return;
    if (this.dialogue.index < this.dialogue.lines.length - 1) {
      this.dialogue.index += 1;
      this.emitHud();
      return;
    }
    const done = this.dialogue.onDone;
    this.dialogue = null;
    this.phase = "playing";
    done?.();
    this.emitHud();
  }

  addItem(id: ItemId, count: number) {
    const slot = this.inventory.find((s) => s.id === id);
    if (slot) slot.count += count;
    else this.inventory.push({ id, count });
  }

  removeItem(id: ItemId, count: number) {
    const slot = this.inventory.find((s) => s.id === id);
    if (!slot) return;
    slot.count -= count;
    if (slot.count <= 0) this.inventory = this.inventory.filter((s) => s.id !== id);
  }

  hasItem(id: ItemId): boolean {
    return (this.inventory.find((s) => s.id === id)?.count ?? 0) > 0;
  }

  useItem(id: ItemId) {
    if (this.phase !== "playing" && this.phase !== "inventory") return;
    const def = ITEMS[id];
    if (!def?.heal) return;
    if (!this.hasItem(id)) {
      this.showToast(`沒有${def.name}`);
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.showToast("生命已滿");
      return;
    }
    this.removeItem(id, 1);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.heal);
    this.addFloat(this.player.x, this.player.y - 28, `+${def.heal}`, "#7dffa0");
    this.burst(this.player.x, this.player.y, "#7dffa0", 10);
    audio.play("heal");
    this.showToast(`使用了${def.name}`);
    if (this.phase === "inventory") this.phase = "playing";
    this.save();
    this.emitHud();
  }

  addFloat(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, text, color, t: 0, life: 0.9 });
  }

  burst(x: number, y: number, color: string, n: number) {
    const room = Math.max(0, this.maxParticles - this.particles.length);
    const count = Math.min(n, room);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0.35 + Math.random() * 0.3,
        max: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  updateAmbient(dt: number) {
    this.ambientTimer += dt;
    if (this.ambientTimer < 0.12) return;
    this.ambientTimer = 0;
    if (this.particles.length > this.maxParticles - 8) return;
    const tx = Math.floor(this.player.x / TILE);
    // forest fireflies / dust
    if (tx >= 28 && Math.random() < 0.55) {
      const x = this.camX + Math.random() * this.viewW;
      const y = this.camY + Math.random() * this.viewH;
      const col = tx >= 40 ? "rgba(180,140,255,0.55)" : "rgba(180,230,140,0.4)";
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: -12 - Math.random() * 18,
        life: 1.2 + Math.random() * 0.8,
        max: 2,
        color: col,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  centerCam(snap: boolean) {
    const targetX = this.player.x + this.camLookX - this.viewW / 2;
    const targetY = this.player.y + this.camLookY - this.viewH / 2;
    const maxX = Math.max(0, WORLD_W - this.viewW);
    const maxY = Math.max(0, WORLD_H - this.viewH);
    const cx = Math.max(0, Math.min(maxX, targetX));
    const cy = Math.max(0, Math.min(maxY, targetY));
    if (snap) {
      this.camX = cx;
      this.camY = cy;
      this.camLookX = 0;
      this.camLookY = 0;
    } else {
      const k = 1 - Math.exp(-7.5 * (1 / 60));
      this.camX += (cx - this.camX) * k;
      this.camY += (cy - this.camY) * k;
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0) {
      shakeX = (Math.random() - 0.5) * this.shake * 14;
      shakeY = (Math.random() - 0.5) * this.shake * 14;
    }

    ctx.save();
    ctx.translate(-this.camX + shakeX, -this.camY + shakeY);
    this.drawMapBackground();
    this.drawTiles();
    this.drawBuildings();

    type DrawItem = { y: number; draw: () => void };
    const items: DrawItem[] = [];
    for (const prop of this.props) items.push({ y: prop.y, draw: () => this.drawProp(prop) });
    for (const n of this.npcs) {
      if (n.id === "bainen" && this.companionJoined) continue;
      items.push({ y: n.y, draw: () => this.drawNpc(n) });
    }
    for (const e of this.enemies) {
      if (!e.dead) items.push({ y: e.y, draw: () => this.drawEnemy(e) });
    }
    items.push({ y: this.player.y, draw: () => this.drawPlayer() });
    if (this.companionJoined) {
      items.push({ y: this.companion.y, draw: () => this.drawCompanion() });
    }
    for (const s of this.slashes) items.push({ y: s.y + 10, draw: () => this.drawSlash(s) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const f of this.floats) {
      ctx.globalAlpha = 1 - f.t / f.life;
      const scale = 1 + (1 - f.t / f.life) * 0.15;
      ctx.font = `bold ${Math.floor(14 * scale)}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.strokeText(f.text, f.x, f.y - f.t * 18);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.t * 18);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // area atmospheric overlay (campus zones)
    const atx = Math.floor(this.player.x / TILE);
    if (atx >= 45) {
      ctx.fillStyle = "rgba(50, 30, 90, 0.16)";
      ctx.fillRect(0, 0, w, h);
    } else if (atx >= 35) {
      ctx.fillStyle = "rgba(40, 90, 70, 0.08)";
      ctx.fillRect(0, 0, w, h);
    } else if (atx >= 18) {
      ctx.fillStyle = "rgba(50, 90, 130, 0.06)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = "rgba(60, 120, 160, 0.05)";
      ctx.fillRect(0, 0, w, h);
    }

    // low HP pulse
    const hpRatio = this.player.hp / Math.max(1, this.player.maxHp);
    if (this.phase === "playing" && hpRatio < 0.35) {
      const pulse = 0.12 + Math.sin(this.animTime * 5) * 0.06;
      const intensity = (0.35 - hpRatio) / 0.35;
      ctx.fillStyle = `rgba(180, 30, 40, ${pulse * intensity})`;
      ctx.fillRect(0, 0, w, h);
    }

    // soft vignette (cache by size)
    const key = `${w}x${h}`;
    if (this.vignetteKey !== key || !this.vignetteCache) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.38)");
      this.vignetteCache = g;
      this.vignetteKey = key;
    }
    ctx.fillStyle = this.vignetteCache;
    ctx.fillRect(0, 0, w, h);
  }

  drawMapBackground() {
    const ctx = this.ctx;
    const img = this.assets.campusWorld;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, WORLD_W, WORLD_H);
      // soft tint so sprites stay readable
      ctx.fillStyle = "rgba(10, 18, 24, 0.18)";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    } else {
      ctx.fillStyle = "#3a6a4a";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  drawTiles() {
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const x1 = Math.min(MAP_W - 1, Math.ceil((this.camX + this.viewW) / TILE) + 1);
    const y1 = Math.min(MAP_H - 1, Math.ceil((this.camY + this.viewH) / TILE) + 1);
    const base: Record<number, [string, string]> = {
      0: ["#4a8a5c", "#3f7a50"], // lawn
      1: ["#c9c2b0", "#b8b09c"], // campus walkway
      2: ["#3a8ab8", "#2f78a0"], // pond
      3: ["#a8b0bc", "#8e96a2"], // plaza stone
      4: ["#7a6e62", "#5e544a"], // buildings
      5: ["#3a6a48", "#2f5a3a"], // tree belt
      6: ["#5aaa62", "#4a9452"], // flower beds
      7: ["#2a3a48", "#1e2c38"], // challenge court
    };
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = this.tiles[y * MAP_W + x] ?? 0;
        const [c1, c2] = base[tile] ?? base[0]!;
        const px = x * TILE;
        const py = y * TILE;
        const solid = tile === 2 || tile === 4;
        ctx.globalAlpha = solid ? 0.72 : 0.42;
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
        ctx.fillRect(px, py, TILE + 0.5, TILE + 0.5);
        ctx.globalAlpha = 1;

        // grass blades
        if (tile === 0 || tile === 6) {
          ctx.fillStyle = "rgba(180,230,120,0.28)";
          const h = 4 + ((x * 13 + y * 7) % 5);
          const sway = Math.sin(this.animTime * 2.2 + x * 0.4 + y * 0.3) * 1.5;
          ctx.fillRect(px + 10 + sway, py + 28, 2, h);
          ctx.fillRect(px + 28 - sway * 0.6, py + 22, 2, h + 2);
          ctx.fillRect(px + 38 + sway * 0.4, py + 30, 2, h - 1);
        }
        // path edge soft shadow
        if (tile === 1) {
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(px, py, TILE, 3);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(px + 8, py + 18, 6, 4);
          ctx.fillRect(px + 26, py + 30, 8, 3);
        }
        // stone plaza
        if (tile === 3) {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
        }
        // flowers
        if (tile === 6) {
          ctx.fillStyle = "#e87aa4";
          ctx.beginPath();
          ctx.arc(px + 16, py + 18, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f5d76e";
          ctx.beginPath();
          ctx.arc(px + 30, py + 28, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#c77dff";
          ctx.beginPath();
          ctx.arc(px + 22, py + 34, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        // water shimmer
        if (tile === 2) {
          const wave = ((this.animTime * 28 + x * 9 + y * 5) % TILE);
          ctx.fillStyle = "rgba(180,230,255,0.18)";
          ctx.fillRect(px, py + wave, TILE, 3);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(px + 6, py + ((wave + 16) % TILE), TILE - 12, 2);
        }
        // dark forest fog tint
        if (tile === 7) {
          ctx.fillStyle = "rgba(40,20,60,0.18)";
          ctx.fillRect(px, py, TILE + 0.5, TILE + 0.5);
        }
        // cliff highlight
        if (tile === 4) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(px, py, TILE, 4);
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(px, py + TILE - 5, TILE, 5);
        }
      }
    }
  }

  drawBuildings() {
    const ctx = this.ctx;
    const hasArt = !!(this.assets.campusWorld && this.assets.campusWorld.naturalWidth);
    for (const b of CAMPUS_BUILDINGS) {
      const x = b.x0 * TILE;
      const y = b.y0 * TILE;
      const w = (b.x1 - b.x0 + 1) * TILE;
      const h = (b.y1 - b.y0 + 1) * TILE;
      if (x + w < this.camX - 40 || x > this.camX + this.viewW + 40) continue;
      if (y + h < this.camY - 40 || y > this.camY + this.viewH + 40) continue;

      if (!hasArt) {
        // procedural buildings only when no campus art
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x + 6, y + h - 4, w - 4, 10);
        ctx.fillStyle = b.color;
        ctx.fillRect(x + 2, y + 10, w - 4, h - 12);
        ctx.fillStyle = b.roof;
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 14);
        ctx.lineTo(x + w / 2, y - 2);
        ctx.lineTo(x + w + 2, y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(200,230,255,0.35)";
        const cols = Math.max(2, Math.floor(w / 36));
        const rows = Math.max(1, Math.floor((h - 20) / 28));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const wx = x + 12 + c * ((w - 24) / cols);
            const wy = y + 22 + r * 26;
            ctx.fillRect(wx, wy, 12, 14);
          }
        }
        ctx.fillStyle = "rgba(30,20,15,0.55)";
        ctx.fillRect(x + w / 2 - 10, y + h - 22, 20, 18);
      } else {
        // soft collision footprint so players see blocked buildings
        ctx.fillStyle = "rgba(10,14,20,0.12)";
        ctx.fillRect(x + 4, y + 8, w - 8, h - 10);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 4, y + 8, w - 8, h - 10);
      }

      const label = b.name;
      ctx.font = "bold 12px Segoe UI, PingFang TC, sans-serif";
      ctx.textAlign = "center";
      const tw = ctx.measureText(label).width + 16;
      const lx = x + w / 2;
      const ly = y + 18;
      ctx.fillStyle = "rgba(10,14,20,0.78)";
      ctx.beginPath();
      // rounded plate
      const rx = lx - tw / 2;
      const ry = ly - 12;
      const rh = 22;
      ctx.roundRect?.(rx, ry, tw, rh, 8);
      if (!ctx.roundRect) ctx.fillRect(rx, ry, tw, rh);
      else ctx.fill();
      ctx.strokeStyle = "rgba(94,228,168,0.35)";
      ctx.lineWidth = 1;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(rx, ry, tw, rh, 8);
        ctx.stroke();
      } else ctx.strokeRect(rx, ry, tw, rh);
      ctx.fillStyle = "#eef3f8";
      ctx.fillText(label, lx, ly + 3);
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const facing = p.facing;
    const moving = p.moving || p.attackTimer > 0;
    const key = moving ? `hero-${facing}` : "hero-idle";
    const img =
      this.assets.frame(key, p.anim) ||
      this.assets.frame("player", p.anim) ||
      this.assets.frame("hero-down", p.anim);
    const size = 72;
    // walk bob: lift on mid-stride frames
    const frame = Math.floor(p.anim) % 4;
    let bob = 0;
    let shadowScale = 1;
    if (p.moving) {
      bob = frame === 1 || frame === 3 ? -3 : 0;
      shadowScale = frame === 1 || frame === 3 ? 0.85 : 1;
    } else {
      bob = Math.sin(this.animTime * 2.6) * 1.5;
      shadowScale = 1 + Math.sin(this.animTime * 2.6) * 0.04;
    }
    // attack lean
    let leanX = 0;
    if (p.attackTimer > 0) {
      if (facing === "left") leanX = -4;
      else if (facing === "right") leanX = 4;
      else if (facing === "up") bob -= 2;
      else bob += 2;
    }
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(p.x + leanX * 0.3, p.y + 17, 15 * shadowScale, 5.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.invuln > 0 && Math.floor(this.animTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }
    // dash trail afterimages
    if (p.dashCd > this.dashMax - 0.12) {
      ctx.globalAlpha = 0.25;
      if (img) {
        ctx.drawImage(img, p.x - size / 2 - leanX * 2, p.y - size + 14 + bob, size, size);
      }
      ctx.globalAlpha = p.invuln > 0 && Math.floor(this.animTime * 20) % 2 === 0 ? 0.45 : 1;
    }
    if (img) {
      ctx.drawImage(img, p.x - size / 2 + leanX, p.y - size + 14 + bob, size, size);
    } else {
      ctx.fillStyle = "#5b9fd4";
      ctx.fillRect(p.x - 14, p.y - 36 + bob, 28, 40);
    }
    ctx.globalAlpha = 1;
  }

  drawCompanion() {
    const ctx = this.ctx;
    const c = this.companion;
    const img = this.assets.frame("companion", c.anim);
    const size = 68;
    const frame = Math.floor(c.anim) % 4;
    const bob = frame === 1 || frame === 3 ? -2.5 : 0;
    const sh = frame === 1 || frame === 3 ? 0.88 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 17, 14 * sh, 5.5 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img) {
      ctx.save();
      if (c.facing === "left") {
        ctx.translate(c.x, c.y + bob);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -size / 2, -size + 14, size, size);
      } else {
        ctx.drawImage(img, c.x - size / 2, c.y - size + 14 + bob, size, size);
      }
      ctx.restore();
    }
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText("柏能學長", c.x, c.y - 48 + bob);
    ctx.fillStyle = "#9dffa8";
    ctx.fillText("柏能學長", c.x, c.y - 48 + bob);
  }

  drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    const key = e.kind === "boss" ? "boss" : e.kind;
    const img = this.assets.frame(key, e.anim);
    const size = e.boss ? 92 : e.kind === "goblin" ? 66 : 56;
    const bob = e.kind === "slime"
      ? Math.abs(Math.sin(e.anim * 1.2)) * -4
      : Math.sin(e.anim * 0.9) * 1.2;
    const squash = e.kind === "slime" ? 1 + Math.sin(e.anim * 2.4) * 0.08 : 1;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 14, size * 0.22 * (2 - squash), 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.hitFlash > 0) ctx.filter = "brightness(2.2) saturate(0.6)";
    if (img) {
      ctx.save();
      const dw = size * squash;
      const dh = size / squash;
      if (this.player.x < e.x && e.kind !== "boss") {
        ctx.translate(e.x, e.y + bob);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -dw / 2, -dh + 10, dw, dh);
      } else {
        ctx.drawImage(img, e.x - dw / 2, e.y - dh + 10 + bob, dw, dh);
      }
      ctx.restore();
    }
    ctx.filter = "none";
    if (e.hp < e.maxHp || e.boss) {
      const bw = e.boss ? 64 : 38;
      const bx = e.x - bw / 2;
      const by = e.y - size + 2;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = "#3a1515";
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = e.boss ? "#c77dff" : "#e85d5d";
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    }
    if (e.boss) {
      ctx.font = "bold 12px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText("挑戰王 張哲維", e.x, e.y - size + 0);
      ctx.fillStyle = "#e0c3ff";
      ctx.fillText("挑戰王 張哲維", e.x, e.y - size + 0);
    }
  }

  drawNpc(n: Npc) {
    const ctx = this.ctx;
    const imgKey = n.id === "bainen" ? "companion" : "npc";
    const img = this.assets.frame(imgKey, n.anim);
    const size = n.id === "kid" ? 54 : n.id === "bainen" ? 70 : 66;
    const bob = Math.sin(this.animTime * 2.2 + n.x * 0.01) * 1.2;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 17, 15, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // waiting-for-rescue marker around buddy
    if (n.id === "bainen" && !this.flags.boss_dead) {
      const pulse = 0.55 + Math.sin(this.animTime * 3) * 0.15;
      ctx.save();
      ctx.strokeStyle = `rgba(94,228,168,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(n.x, n.y - 8, 28, 36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(94,228,168,${pulse * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(n.x, n.y - 8, 22, 30, this.animTime * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      // runes
      ctx.fillStyle = `rgba(94,228,168,${pulse})`;
      for (let i = 0; i < 6; i++) {
        const a = this.animTime * 1.2 + (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(n.x + Math.cos(a) * 26, n.y - 8 + Math.sin(a) * 34, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (img) {
      ctx.save();
      // subtle role tints on shared campus staff sprite
      if (n.id === "merchant") ctx.filter = "hue-rotate(35deg) saturate(1.05) brightness(1.05)";
      else if (n.id === "kid") ctx.filter = "hue-rotate(-15deg) brightness(1.12) saturate(0.9)";
      else if (n.id === "librarian") ctx.filter = "hue-rotate(200deg) saturate(0.85)";
      else if (n.id === "gym") ctx.filter = "hue-rotate(90deg) saturate(1.1)";
      else if (n.id === "biz" || n.id === "sac_staff") ctx.filter = "hue-rotate(300deg) saturate(0.9)";
      else if (n.id === "elder") ctx.filter = "none";
      ctx.drawImage(img, n.x - size / 2, n.y - size + 14 + bob, size, size);
      ctx.restore();
    }
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(n.name, n.x, n.y - 50 + bob);
    ctx.fillStyle = n.id === "bainen" ? "#f0a0c0" : "#eef3f8";
    ctx.fillText(n.name, n.x, n.y - 50 + bob);

    if (n.id === "bainen" && !this.flags.princess_rescued) {
      ctx.fillStyle = this.flags.boss_dead ? "#7dffa0" : "#f0a0c0";
      ctx.font = "bold 16px Segoe UI, sans-serif";
      ctx.fillText(
        this.flags.boss_dead ? "!" : "…",
        n.x,
        n.y - 62 + Math.sin(this.animTime * 3) * 2,
      );
    }

    if (n.questId) {
      const q = this.quests.find((x) => x.id === n.questId);
      if (q && (q.status === "inactive" || q.status === "complete")) {
        ctx.fillStyle = q.status === "complete" ? "#7dffa0" : "#f5d76e";
        ctx.font = "bold 18px Segoe UI, sans-serif";
        ctx.fillText(
          q.status === "complete" ? "?" : "!",
          n.x,
          n.y - 62 + Math.sin(this.animTime * 3) * 2,
        );
      }
    }
  }

  drawProp(prop: Prop) {
    const ctx = this.ctx;
    const img = this.assets.frame(prop.kind, 0);
    let w = prop.kind === "tree" ? 80 : prop.kind === "rock" ? 52 : 48;
    let h = prop.kind === "tree" ? 92 : prop.kind === "rock" ? 48 : 48;
    if (prop.kind === "sign") {
      w = 44;
      h = 52;
    }
    if (prop.kind === "chest") {
      w = 48;
      h = 42;
    }

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(prop.x, prop.y + 12, w * 0.3, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (img) {
      ctx.save();
      if (prop.kind === "chest" && prop.opened) ctx.globalAlpha = 0.55;
      if (prop.kind === "tree") {
        const sway = Math.sin(this.animTime * 1.4 + prop.x * 0.02) * 2.2;
        ctx.translate(prop.x, prop.y + 14);
        ctx.rotate(sway * 0.012);
        ctx.drawImage(img, -w / 2, -h, w, h);
      } else {
        ctx.drawImage(img, prop.x - w / 2, prop.y - h + 14, w, h);
      }
      ctx.restore();
    } else if (prop.kind === "house") {
      ctx.fillStyle = "#6b5344";
      ctx.fillRect(prop.x - w / 2, prop.y - h, w, h);
    }
  }

  drawSlash(s: SlashFx) {
    const ctx = this.ctx;
    const frame = (s.t / s.life) * 4;
    const img = this.assets.frame("slash", frame);
    const size = 72;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.dir === "left") ctx.scale(-1, 1);
    if (s.dir === "up") ctx.rotate(-Math.PI / 2);
    if (s.dir === "down") ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.92;
    if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  setTouchMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  queueDash() {
    this.tryDash();
  }
}
