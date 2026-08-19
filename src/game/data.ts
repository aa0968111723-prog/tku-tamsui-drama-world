import type { ItemDef, ItemId, Npc, Prop, Quest, Enemy } from "./types";

export const TILE = 48;
export const MAP_W = 56;
export const MAP_H = 36;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Named campus buildings (tile coords, inclusive). Drawn as solid blocks with labels. */
export type CampusBuilding = {
  id: string;
  name: string;
  nameEn?: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  roof: string;
};

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: "palace",
    name: "宮燈教室",
    nameEn: "Palace Classrooms",
    x0: 6,
    y0: 4,
    x1: 12,
    y1: 8,
    color: "#a85a4a",
    roof: "#7a3028",
  },
  {
    id: "cafeteria",
    name: "美食廣場",
    nameEn: "Food Court",
    x0: 5,
    y0: 22,
    x1: 11,
    y1: 26,
    color: "#c49a5a",
    roof: "#8a6a38",
  },
  {
    id: "library",
    name: "覺生紀念圖書館",
    nameEn: "Library",
    x0: 18,
    y0: 5,
    x1: 25,
    y1: 11,
    color: "#5a7a9a",
    roof: "#3a5570",
  },
  {
    id: "biz",
    name: "商管大樓",
    nameEn: "Business",
    x0: 27,
    y0: 5,
    x1: 32,
    y1: 10,
    color: "#6a8a9a",
    roof: "#4a6570",
  },
  {
    id: "liberal",
    name: "文學館",
    nameEn: "Liberal Arts",
    x0: 18,
    y0: 22,
    x1: 23,
    y1: 26,
    color: "#8a7a6a",
    roof: "#5a4a3a",
  },
  {
    id: "gym",
    name: "紹謨體育館",
    nameEn: "Gymnasium",
    x0: 36,
    y0: 4,
    x1: 42,
    y1: 9,
    color: "#5a8a6a",
    roof: "#3a654a",
  },
  {
    id: "sac",
    name: "學生活動中心",
    nameEn: "Student Center",
    x0: 35,
    y0: 22,
    x1: 41,
    y1: 27,
    color: "#7a6aaa",
    roof: "#4a3a7a",
  },
  {
    id: "chingsheng",
    name: "驚聲紀念大樓",
    nameEn: "Ching-sheng Hall",
    x0: 46,
    y0: 6,
    x1: 52,
    y1: 12,
    color: "#6a5a8a",
    roof: "#3a2a5a",
  },
  {
    id: "admin",
    name: "行政大樓",
    nameEn: "Admin",
    x0: 48,
    y0: 22,
    x1: 53,
    y1: 26,
    color: "#7a7a8a",
    roof: "#4a4a5a",
  },
];

export const ITEMS: Record<ItemId, ItemDef> = {
  potion: {
    id: "potion",
    name: "提神飲料",
    desc: "學餐熱銷。恢復 40 點體力。",
    heal: 40,
  },
  herb: {
    id: "herb",
    name: "學餐便當",
    desc: "熱騰騰的。恢復 20 點體力。",
    heal: 20,
  },
  key: {
    id: "key",
    name: "活動中心鑰匙",
    desc: "社團備用鑰匙（任務道具）。",
    quest: true,
  },
  anjie_token: {
    id: "anjie_token",
    name: "完課戳章卡",
    desc: "新生導覽證明，回宮燈大道交給總召。",
    quest: true,
  },
};

/** Tile types: 0 grass, 1 path, 2 water, 3 plaza, 4 building, 5 tree, 6 flower, 7 court */
export function buildTileMap(): Uint8Array {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // base grass
  tiles.fill(0);

  // main east-west avenue (宮燈大道 → 驚聲)
  fill(3, 14, 52, 17, 1);
  // north-south connectors
  fill(11, 8, 13, 22, 1);
  fill(20, 10, 22, 24, 1);
  fill(28, 10, 30, 20, 1);
  fill(37, 9, 39, 24, 1);
  fill(47, 11, 49, 22, 1);

  // plazas
  fill(9, 13, 15, 18, 3); // 宮燈
  fill(19, 12, 24, 16, 3); // 書卷
  fill(36, 12, 41, 17, 3); // 體育前
  fill(45, 13, 51, 18, 3); // 驚聲挑戰

  // small fountain / water
  fill(22, 18, 24, 20, 2);
  fill(12, 20, 13, 21, 2);

  // flower beds
  fill(8, 10, 10, 11, 6);
  fill(16, 16, 17, 18, 6);
  fill(34, 18, 35, 20, 6);

  // tree belts
  for (let x = 2; x < MAP_W - 2; x++) {
    if (x % 3 === 0) {
      set(x, 2, 5);
      set(x, MAP_H - 3, 5);
    }
  }
  for (let y = 3; y < MAP_H - 3; y++) {
    if (y % 4 === 0) {
      set(2, y, 5);
      set(MAP_W - 3, y, 5);
    }
  }

  // court near gym
  fill(38, 18, 41, 20, 7);

  // buildings solid
  for (const b of CAMPUS_BUILDINGS) {
    fill(b.x0, b.y0, b.x1, b.y1, 4);
  }
  // keep entrance paths into buildings open (south edge center)
  for (const b of CAMPUS_BUILDINGS) {
    const mx = Math.floor((b.x0 + b.x1) / 2);
    set(mx, b.y1, 1);
    if (b.y1 + 1 < MAP_H) set(mx, b.y1 + 1, 1);
  }

  return tiles;
}

export function isSolidTile(t: number): boolean {
  return t === 2 || t === 4 || t === 5;
}

export function createInitialQuests(): Quest[] {
  return [
    {
      id: "shadow_king",
      title: "迎新闖關 · 尋找柏能",
      desc: "走訪淡水校園，完成驚聲廣場挑戰，找到迷路的柏能學長，再回宮燈大道回報。",
      status: "inactive",
      target: "boss",
      progress: 0,
      goal: 1,
    },
    {
      id: "slime_hunt",
      title: "清理迷航史萊姆",
      desc: "校園裡出現 5 隻「迷航史萊姆」，幫美食廣場阿姨清掉。",
      status: "inactive",
      target: "slime",
      progress: 0,
      goal: 5,
    },
    {
      id: "campus_stamps",
      title: "新生校園戳章",
      desc: "向 5 位導覽員打聽館舍，集滿戳章認識校園。",
      status: "inactive",
      target: "stamps",
      progress: 0,
      goal: 5,
    },
  ];
}

/** NPCs that grant campus orientation stamps */
export const STAMP_NPC_IDS = ["kid", "librarian", "biz", "gym", "sac_staff"] as const;

export const STAMP_LABELS: Record<string, string> = {
  kid: "克難坡／宮燈",
  librarian: "覺生圖書館",
  biz: "商管大樓",
  gym: "紹謨體育館",
  sac_staff: "學生活動中心",
};

export function createNpcs(): Npc[] {
  return [
    {
      id: "elder",
      name: "迎新總召 小雨",
      x: 12 * TILE + 24,
      y: 14 * TILE + 24,
      anim: 0,
      questId: "shadow_king",
      lines: [
        [
          "安倢同學，歡迎來到淡江大學淡水校園！",
          "你現在在「宮燈大道」迎新點。右邊是宮燈教室，下方是美食廣場。",
          "柏能學長在東邊「驚聲紀念大樓」前失聯了——請沿主幹道往東找他！",
          "路上向導覽員打聽，可集「新生戳章」；也可幫學餐清迷航史萊姆。",
        ],
        [
          "路線：宮燈大道 → 書卷廣場／圖書館 → 體育館 → 驚聲挑戰廣場。",
          "路上看告示牌與各館導覽員，認識校園。加油！",
        ],
        [
          "太好了！柏能學長平安，你的新生戳章也齊了。",
          "從今天起，你正式成為淡江人。歡迎回家！",
        ],
      ],
    },
    {
      id: "merchant",
      name: "學餐阿姨 阿貞",
      x: 8 * TILE + 24,
      y: 20 * TILE + 24,
      anim: 0,
      questId: "slime_hunt",
      lines: [
        [
          "美食廣場這邊啊，後面全是綠色的「迷航史萊姆」！",
          "幫阿姨清 5 隻，請你喝提神飲料。",
        ],
        ["再清幾隻就好，便當還熱著。"],
        ["謝謝啦！這瓶提神飲料拿去挑戰廣場吧。"],
      ],
    },
    {
      id: "kid",
      name: "學弟 小宇",
      x: 14 * TILE + 24,
      y: 18 * TILE + 24,
      anim: 0,
      lines: [
        [
          "學姊！從捷運淡水站上來要走「克難坡」，超有名的長坡。",
          "宮燈教室晚上燈光超美，適合拍照。",
          "主幹道一直往東，就會到驚聲紀念大樓。",
          "（獲得戳章：克難坡／宮燈）",
        ],
      ],
    },
    {
      id: "librarian",
      name: "圖書館志工 雅婷",
      x: 21 * TILE + 24,
      y: 12 * TILE + 24,
      anim: 0,
      lines: [
        [
          "這裡是覺生紀念圖書館（U）前方。",
          "記得辦借書證、善用自習區與電子資料庫。",
          "考試週很擠，早點來比較有位子！",
          "（獲得戳章：覺生圖書館）",
        ],
      ],
    },
    {
      id: "biz",
      name: "商管學長 冠宇",
      x: 29 * TILE + 24,
      y: 11 * TILE + 24,
      anim: 0,
      lines: [
        [
          "商管大樓這區常有企業講座、社團招生。",
          "書卷廣場常辦活動，新生可多逛逛。",
          "再往東是體育館與學生活動中心。",
          "（獲得戳章：商管大樓）",
        ],
      ],
    },
    {
      id: "gym",
      name: "體育助教 小凱",
      x: 38 * TILE + 24,
      y: 11 * TILE + 24,
      anim: 0,
      lines: [
        [
          "紹謨紀念體育館可以修體育課、打球、借場。",
          "對面活動中心有社團辦公室與大型活動。",
          "前方驚聲廣場有迎新模擬戰，熱身一下再去！",
          "（獲得戳章：紹謨體育館）",
        ],
      ],
    },
    {
      id: "sac_staff",
      name: "社團幹部 庭瑜",
      x: 37 * TILE + 24,
      y: 20 * TILE + 24,
      anim: 0,
      lines: [
        [
          "學生活動中心（R）——社團家。",
          "社團博覽會、演唱會、演講多在這附近。",
          "有空一定要加入至少一個社團喔！",
          "（獲得戳章：學生活動中心）",
        ],
      ],
    },
    {
      id: "bainen",
      name: "柏能學長",
      x: 49 * TILE + 24,
      y: 14 * TILE + 24,
      anim: 0,
      lines: [
        [
          "安倢……你來了！我在驚聲紀念大樓前被卡住了。",
          "張哲維學長的「迎新挑戰」擋在廣場上。",
          "先通過挑戰，我們再一起回宮燈大道集合！",
        ],
        [
          "你過關了！不愧是新生之星。",
          "這份完課戳章卡收好——我們一起回宮燈大道找小雨回報。",
          "歡迎加入淡江——之後校園一起慢慢認識！",
        ],
        ["有問題隨時找學長。一起走吧！"],
      ],
    },
  ];
}

export function createProps(): Prop[] {
  const props: Prop[] = [];
  let n = 0;
  const add = (p: Omit<Prop, "id">) => {
    props.push({ ...p, id: `p${n++}` });
  };

  for (const [tx, ty] of [
    [4, 6],
    [4, 20],
    [13, 6],
    [16, 24],
    [26, 4],
    [33, 6],
    [33, 26],
    [43, 4],
    [43, 28],
    [54, 14],
    [15, 28],
    [28, 28],
    [40, 30],
    [50, 30],
  ] as const) {
    add({
      kind: "tree",
      x: tx * TILE + 24,
      y: ty * TILE + 24,
      w: 40,
      h: 28,
      solid: true,
    });
  }

  for (const [tx, ty] of [
    [44, 8],
    [45, 22],
    [50, 18],
    [42, 16],
    [34, 18],
  ] as const) {
    add({
      kind: "rock",
      x: tx * TILE + 24,
      y: ty * TILE + 24,
      w: 28,
      h: 22,
      solid: true,
    });
  }

  // campus signs
  for (const [tx, ty] of [
    [12, 13],
    [21, 14],
    [38, 14],
    [46, 14],
  ] as const) {
    add({
      kind: "sign",
      x: tx * TILE + 24,
      y: ty * TILE + 24,
      w: 20,
      h: 24,
      solid: false,
    });
  }

  add({
    kind: "chest",
    x: 9 * TILE + 24,
    y: 19 * TILE + 24,
    w: 28,
    h: 24,
    solid: true,
  });

  return props;
}

export function createEnemies(): Enemy[] {
  const list: Enemy[] = [];
  let n = 0;
  const slime = (tx: number, ty: number): Enemy => ({
    id: `e${n++}`,
    kind: "slime",
    x: tx * TILE + 24,
    y: ty * TILE + 24,
    hp: 28,
    maxHp: 28,
    atk: 6,
    speed: 55,
    radius: 16,
    xp: 12,
    gold: 5,
    anim: Math.random() * 4,
    hitFlash: 0,
    knockbackX: 0,
    knockbackY: 0,
    aggro: 0,
    dead: false,
  });
  const goblin = (tx: number, ty: number): Enemy => ({
    id: `e${n++}`,
    kind: "goblin",
    x: tx * TILE + 24,
    y: ty * TILE + 24,
    hp: 48,
    maxHp: 48,
    atk: 10,
    speed: 70,
    radius: 18,
    xp: 22,
    gold: 12,
    anim: Math.random() * 4,
    hitFlash: 0,
    knockbackX: 0,
    knockbackY: 0,
    aggro: 0,
    dead: false,
  });

  for (const [x, y] of [
    [26, 14],
    [28, 18],
    [30, 16],
    [32, 13],
    [33, 19],
    [35, 15],
    [36, 18],
    [31, 22],
    [29, 12],
    [34, 20],
  ] as const) {
    list.push(slime(x, y));
  }
  for (const [x, y] of [
    [42, 14],
    [44, 18],
    [46, 15],
    [43, 12],
    [41, 17],
  ] as const) {
    list.push(goblin(x, y));
  }

  list.push({
    id: "boss",
    kind: "boss",
    x: 47 * TILE + 24,
    y: 15 * TILE + 24,
    hp: 220,
    maxHp: 220,
    atk: 16,
    speed: 50,
    radius: 28,
    xp: 120,
    gold: 100,
    anim: 0,
    hitFlash: 0,
    knockbackX: 0,
    knockbackY: 0,
    aggro: 0,
    dead: false,
    boss: true,
    phase: 1,
    atkCd: 0,
  });

  return list;
}

export function xpForLevel(level: number): number {
  return Math.floor(40 + level * 28 + level * level * 6);
}

export function playerAtkForLevel(level: number): number {
  return 10 + (level - 1) * 3;
}

export function playerDefForLevel(level: number): number {
  return 2 + (level - 1);
}

export function playerMaxHpForLevel(level: number): number {
  return 80 + (level - 1) * 18;
}
