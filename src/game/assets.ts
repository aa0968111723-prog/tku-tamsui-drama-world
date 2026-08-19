export type SpriteKey =
  | "player"
  | "slime"
  | "goblin"
  | "npc"
  | "boss"
  | "slash"
  | "tree"
  | "rock"
  | "chest"
  | "sign"
  | "companion";

const FRAME_PATHS: Record<string, string[]> = {
  "hero-down": [
    "/sprites/hero-down-1.png",
    "/sprites/hero-down-2.png",
    "/sprites/hero-down-3.png",
    "/sprites/hero-down-4.png",
  ],
  "hero-left": [
    "/sprites/hero-left-1.png",
    "/sprites/hero-left-2.png",
    "/sprites/hero-left-3.png",
    "/sprites/hero-left-4.png",
  ],
  "hero-right": [
    "/sprites/hero-right-1.png",
    "/sprites/hero-right-2.png",
    "/sprites/hero-right-3.png",
    "/sprites/hero-right-4.png",
  ],
  "hero-up": [
    "/sprites/hero-up-1.png",
    "/sprites/hero-up-2.png",
    "/sprites/hero-up-3.png",
    "/sprites/hero-up-4.png",
  ],
  "hero-idle": [
    "/sprites/hero-idle-1.png",
    "/sprites/hero-idle-2.png",
    "/sprites/hero-idle-3.png",
    "/sprites/hero-idle-4.png",
  ],
  player: [
    "/sprites/hero-down-1.png",
    "/sprites/hero-down-2.png",
    "/sprites/hero-down-3.png",
    "/sprites/hero-down-4.png",
  ],
  slime: [
    "/sprites/slime-f1.png",
    "/sprites/slime-f2.png",
    "/sprites/slime-f3.png",
    "/sprites/slime-f4.png",
  ],
  goblin: [
    "/sprites/goblin-f1.png",
    "/sprites/goblin-f2.png",
    "/sprites/goblin-f3.png",
    "/sprites/goblin-f4.png",
  ],
  npc: [
    "/sprites/npc-f1.png",
    "/sprites/npc-f2.png",
    "/sprites/npc-f3.png",
    "/sprites/npc-f4.png",
  ],
  boss: [
    "/sprites/boss-f1.png",
    "/sprites/boss-f2.png",
    "/sprites/boss-f3.png",
    "/sprites/boss-f4.png",
  ],
  companion: [
    "/sprites/companion-f1.png",
    "/sprites/companion-f2.png",
    "/sprites/companion-f3.png",
    "/sprites/companion-f4.png",
  ],
  slash: [
    "/sprites/slash-f1.png",
    "/sprites/slash-f2.png",
    "/sprites/slash-f3.png",
    "/sprites/slash-f4.png",
  ],
  tree: ["/sprites/tree.png"],
  rock: ["/sprites/rock.png"],
  chest: ["/sprites/chest.png"],
  sign: ["/sprites/sign.png"],
};

export class AssetBank {
  private images = new Map<string, HTMLImageElement[]>();
  campusWorld: HTMLImageElement | null = null;
  campusOfficial: HTMLImageElement | null = null;
  ready = false;

  async load(): Promise<void> {
    const entries = Object.entries(FRAME_PATHS);
    await Promise.all(
      entries.map(async ([key, paths]) => {
        const imgs = await Promise.all(paths.map((p) => loadImage(p)));
        this.images.set(key, imgs);
      }),
    );
    // Campus maps — non-fatal if missing
    try {
      this.campusWorld = await loadImage("/map/tku-campus-world.jpg?v=fix7");
    } catch {
      this.campusWorld = null;
    }
    try {
      this.campusOfficial = await loadImage("/map/tku-official-ui.png?v=fix7");
    } catch {
      try {
        this.campusOfficial = await loadImage("/map/tku-official.png?v=fix7");
      } catch {
        this.campusOfficial = null;
      }
    }
    this.ready = true;
  }

  frame(key: string, index: number): HTMLImageElement | null {
    const frames = this.images.get(key);
    if (!frames || frames.length === 0) return null;
    const i = ((Math.floor(index) % frames.length) + frames.length) % frames.length;
    return frames[i] ?? null;
  }

  frameCount(key: string): number {
    return this.images.get(key)?.length ?? 0;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const bust = src.includes("?") ? src : `${src}?v=fix7`;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = bust;
  });
}
