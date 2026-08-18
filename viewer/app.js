// Local preview for the World-as-Code drama world.
// Fetches world/world.json (served from the repo root) and renders it.

const WORLD_URL = "../world/world.json";

const el = (id) => document.getElementById(id);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );

function initial(name) {
  return (name || "?").trim().charAt(0);
}

function renderSetting(world) {
  const s = world.setting || {};
  const items = [
    ["地區", s.region],
    ["校園", s.campus],
    ["基調", s.tone],
    ["時代", s.era],
    ["語系", world.locale],
  ].filter(([, v]) => v);
  el("setting-chips").innerHTML = items
    .map(
      ([k, v]) =>
        `<span class="chip">${escape(k)}：<strong>${escape(v)}</strong></span>`
    )
    .join("");
}

function renderLocations(world) {
  const locs = world.locations || [];
  el("locations").innerHTML = `
    <div class="grid">
      ${locs
        .map(
          (l) => `
        <article class="card">
          <h3>${escape(l.name)}</h3>
          <div class="en">${escape(l.en || "")}</div>
          ${l.mood ? `<span class="mood">${escape(l.mood)}</span>` : ""}
          <p class="desc">${escape(l.desc || "")}</p>
          <div class="tags">
            ${(l.tags || [])
              .map((t) => `<span class="tag">#${escape(t)}</span>`)
              .join("")}
          </div>
        </article>`
        )
        .join("")}
    </div>`;
}

function renderCharacters(world) {
  const chars = world.characters || [];
  el("characters").innerHTML = `
    <div class="grid">
      ${chars
        .map((c) => {
          const color = c.color || "#5ee4a8";
          return `
        <article class="card char-card">
          <div class="avatar" style="background:${escape(color)}">${escape(
            initial(c.name)
          )}</div>
          <div>
            <h3>${escape(c.name)}</h3>
            <p class="char-meta"><b>${escape(c.role || "")}</b> · ${escape(
            c.year || ""
          )}</p>
            <p class="char-meta">性格：${escape(c.trait || "—")}</p>
            <p class="char-meta">目標：${escape(c.goal || "—")}</p>
          </div>
        </article>`;
        })
        .join("")}
    </div>`;
}

function renderEpisode(world) {
  const ep = world.episode || {};
  const charById = Object.fromEntries(
    (world.characters || []).map((c) => [c.id, c])
  );
  const locById = Object.fromEntries(
    (world.locations || []).map((l) => [l.id, l])
  );

  const scenes = (ep.scenes || [])
    .map((scene, i) => {
      const loc = locById[scene.locationId];
      const beats = (scene.beats || [])
        .map((b) => {
          if (b.type === "dialogue") {
            const c = charById[b.speaker];
            const color = (c && c.color) || "#5ee4a8";
            const name = (c && c.name) || b.speaker;
            return `<p class="beat dialogue" style="--speaker:${escape(
              color
            )}"><span class="speaker">${escape(name)}</span>${escape(
              b.text
            )}</p>`;
          }
          return `<p class="beat ${escape(b.type)}">${escape(b.text)}</p>`;
        })
        .join("");
      return `
      <article class="scene">
        <h3 class="scene-title"><span class="no">${String(i + 1).padStart(
          2,
          "0"
        )}</span>${escape(scene.title)}</h3>
        <p class="scene-loc">📍 ${escape(
          loc ? loc.name : scene.locationId
        )}</p>
        ${beats}
      </article>`;
    })
    .join("");

  el("episode").innerHTML = `
    <div class="episode-head">
      <h2>${escape(ep.title || "")}</h2>
      <p class="logline">${escape(ep.logline || "")}</p>
    </div>
    ${scenes}`;
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      el(tab.dataset.target).classList.add("is-active");
    });
  });
}

async function main() {
  try {
    const res = await fetch(WORLD_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${WORLD_URL}`);
    const world = await res.json();

    el("world-title").textContent = world.title || "World";
    el("world-subtitle").textContent = world.subtitle || "";
    renderSetting(world);
    renderLocations(world);
    renderCharacters(world);
    renderEpisode(world);
  } catch (err) {
    const box = el("error");
    box.hidden = false;
    box.textContent = `無法載入 world.json：${err.message}`;
    el("world-title").textContent = "載入失敗";
  }
}

setupTabs();
main();
