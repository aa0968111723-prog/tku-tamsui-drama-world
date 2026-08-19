/** Client-side GitHub export helpers (no secrets in source). */

export type GithubTarget = {
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
};

const KEY = "tku-world-github-v1";

export function loadGithubTarget(): GithubTarget {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultTarget(), ...JSON.parse(raw) };
  } catch { /* */ }
  return defaultTarget();
}

export function saveGithubTarget(t: GithubTarget) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

function defaultTarget(): GithubTarget {
  return {
    owner: "aa0968111723-prog",
    repo: "tku-tamsui-drama-world",
    branch: "main",
    pathPrefix: "world",
  };
}

export function buildWorldFiles(world: unknown, projectTitle: string): { path: string; content: string }[] {
  const w = world as {
    title: string;
    subtitle?: string;
    setting?: Record<string, string>;
    locations?: { id: string; name: string; desc: string; mood: string }[];
    characters?: { id: string; name: string; role: string; trait: string; goal: string }[];
    episode?: {
      title: string;
      logline: string;
      scenes: {
        title: string;
        locationId: string;
        characters: string[];
        beats: { type: string; speaker?: string; text: string }[];
      }[];
    };
  };

  const readme = `# ${projectTitle}

> ${w.subtitle ?? "淡江大學 × 淡水 · 戲劇虛擬世界"}

這是可持續開發的**劇本世界工程**（World as Code）。

## 結構

\`\`\`
world/
  world.json          # 世界狀態（地點、角色、集數）
  SCRIPT.md           # 人類可讀劇本
  LOCATIONS.md        # 場景聖經
  CHARACTERS.md       # 角色卡
  DEVLOG.md           # 開發日誌
\`\`\`

## 設定

- 地區：${w.setting?.region ?? "淡水"}
- 校園：${w.setting?.campus ?? "淡江大學"}
- 基調：${w.setting?.tone ?? ""}

## 持續開發

1. 在虛擬世界編輯器調整場景／對白
2. 匯出並 commit 到本 repo
3. 開 PR 擴充第二集、支線、新地點

## 與遊戲／攝影棚

- \`/play\` — 進入 3D 校園闖關體驗
- 素材庫 — \`public/studio/\`
`;

  const scriptLines: string[] = [
    `# ${w.episode?.title ?? "劇本"}`,
    "",
    `> ${w.episode?.logline ?? ""}`,
    "",
  ];
  for (const scene of w.episode?.scenes ?? []) {
    scriptLines.push(`## ${scene.title}`);
    scriptLines.push("");
    scriptLines.push(`- 地點：\`${scene.locationId}\``);
    scriptLines.push(`- 出場：${scene.characters.join("、")}`);
    scriptLines.push("");
    for (const beat of scene.beats) {
      if (beat.type === "dialogue") {
        scriptLines.push(`**${beat.speaker}**：${beat.text}`);
      } else if (beat.type === "action") {
        scriptLines.push(`*(${beat.text})*`);
      } else {
        scriptLines.push(`> 註：${beat.text}`);
      }
      scriptLines.push("");
    }
  }

  const locMd = [
    "# 場景聖經 · Locations",
    "",
    ...(w.locations ?? []).flatMap((l) => [
      `## ${l.name} (\`${l.id}\`)`,
      "",
      `- 情緒：${l.mood}`,
      "",
      l.desc,
      "",
    ]),
  ].join("\n");

  const charMd = [
    "# 角色卡 · Characters",
    "",
    ...(w.characters ?? []).flatMap((c) => [
      `## ${c.name} (\`${c.id}\`)`,
      "",
      `- 定位：${c.role}`,
      `- 特質：${c.trait}`,
      `- 目標：${c.goal}`,
      "",
    ]),
  ].join("\n");

  const devlog = `# DEVLOG

## ${new Date().toISOString().slice(0, 10)}

- 由虛擬世界編輯器匯出
- 世界：${projectTitle}
- 場景數：${w.locations?.length ?? 0}
- 角色數：${w.characters?.length ?? 0}
- 本集場次數：${w.episode?.scenes?.length ?? 0}
`;

  return [
    { path: "README.md", content: readme },
    { path: "world/world.json", content: JSON.stringify(world, null, 2) },
    { path: "world/SCRIPT.md", content: scriptLines.join("\n") },
    { path: "world/LOCATIONS.md", content: locMd },
    { path: "world/CHARACTERS.md", content: charMd },
    { path: "world/DEVLOG.md", content: devlog },
  ];
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadWorldPack(files: { path: string; content: string }[], zipName = "tku-tamsui-world") {
  // lightweight: download as single JSON pack + main SCRIPT
  const pack = {
    exportedAt: new Date().toISOString(),
    files,
  };
  downloadText(`${zipName}-pack.json`, JSON.stringify(pack, null, 2));
  const script = files.find((f) => f.path.endsWith("SCRIPT.md"));
  if (script) downloadText("SCRIPT.md", script.content);
}
