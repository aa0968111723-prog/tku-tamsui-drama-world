import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree, useLoader } from "@react-three/fiber";
import { Html, Sky, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useGame, CELL, type Building3, type Enemy3, type Npc3 } from "../store";
import { MAP_W, MAP_H, buildTileMap, isSolidTile } from "../data";

const tilesCache = buildTileMap();
const WORLD_W = MAP_W * CELL;
const WORLD_H = MAP_H * CELL;

function useRepeatTexture(url: string, repeat: [number, number] = [1, 1]) {
  const tex = useLoader(THREE.TextureLoader, url);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }, [tex, repeat[0], repeat[1]]);
  return tex;
}

function Ground() {
  const campusMap = useLoader(THREE.TextureLoader, "/textures/campus-ground.jpg");
  const grass = useRepeatTexture("/textures/ground-grass.jpg", [18, 12]);

  useMemo(() => {
    campusMap.colorSpace = THREE.SRGBColorSpace;
    campusMap.anisotropy = 8;
    campusMap.wrapS = campusMap.wrapT = THREE.ClampToEdgeWrapping;
  }, [campusMap]);

  // path overlay geometry from tiles
  const pathGeo = useMemo(() => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vi = 0;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const t = tilesCache[ty * MAP_W + tx] ?? 0;
        // only walkable path/plaza/court as raised concrete strips
        if (t !== 1 && t !== 3 && t !== 7) continue;
        const x0 = (tx - MAP_W / 2) * CELL;
        const z0 = (ty - MAP_H / 2) * CELL;
        const x1 = x0 + CELL;
        const z1 = z0 + CELL;
        const y = 0.04;
        positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  // water patches
  const waterGeo = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    let vi = 0;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tilesCache[ty * MAP_W + tx] !== 2) continue;
        const x0 = (tx - MAP_W / 2) * CELL;
        const z0 = (ty - MAP_H / 2) * CELL;
        const x1 = x0 + CELL;
        const z1 = z0 + CELL;
        positions.push(x0, -0.05, z0, x1, -0.05, z0, x1, -0.05, z1, x0, -0.05, z1);
        indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group>
      {/* large soft grass base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[WORLD_W * 1.4, WORLD_H * 1.4]} />
        <meshStandardMaterial map={grass} roughness={0.95} metalness={0} />
      </mesh>
      {/* photoreal campus map as main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshStandardMaterial
          map={campusMap}
          roughness={0.9}
          metalness={0.02}
          envMapIntensity={0.35}
        />
      </mesh>
      {/* path highlight */}
      <mesh geometry={pathGeo} receiveShadow>
        <meshStandardMaterial
          color="#d8d2c4"
          roughness={0.85}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>
      {/* water */}
      <mesh geometry={waterGeo} receiveShadow>
        <meshStandardMaterial
          color="#3a8ab8"
          roughness={0.15}
          metalness={0.35}
          transparent
          opacity={0.75}
          envMapIntensity={1.2}
        />
      </mesh>
      {/* outer ring hills color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <ringGeometry args={[Math.max(WORLD_W, WORLD_H) * 0.55, Math.max(WORLD_W, WORLD_H) * 1.1, 64]} />
        <meshStandardMaterial color="#5a8a55" roughness={1} />
      </mesh>
    </group>
  );
}

function BuildingMesh({
  b,
  stone,
  brick,
  roof,
}: {
  b: Building3;
  stone: THREE.Texture;
  brick: THREE.Texture;
  roof: THREE.Texture;
}) {
  const useBrick = ["palace", "library", "admin", "biz"].includes(b.id);
  const facade = useBrick ? brick : stone;

  // per-building UV scale
  const bodyMat = useMemo(() => {
    const map = facade.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(Math.max(1.5, b.w * 0.45), Math.max(1.2, b.h * 0.55));
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [facade, b.w, b.h]);

  const roofMap = useMemo(() => {
    const map = roof.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(Math.max(2, b.w * 0.5), Math.max(2, b.d * 0.5));
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [roof, b.w, b.d]);

  return (
    <group position={[b.x, 0, b.z]}>
      {/* foundation */}
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[b.w * 0.98, 0.28, b.d * 0.98]} />
        <meshStandardMaterial color="#6a655c" roughness={0.95} />
      </mesh>
      {/* main body */}
      <mesh position={[0, b.h / 2 + 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w * 0.9, b.h, b.d * 0.9]} />
        <meshStandardMaterial map={bodyMat} roughness={0.72} metalness={0.05} envMapIntensity={0.4} />
      </mesh>
      {/* glass strip accent */}
      <mesh position={[0, b.h * 0.55, b.d * 0.452]} castShadow>
        <boxGeometry args={[b.w * 0.72, b.h * 0.55, 0.06]} />
        <meshStandardMaterial
          color="#8ec8e8"
          roughness={0.12}
          metalness={0.65}
          transparent
          opacity={0.55}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* roof slab */}
      <mesh position={[0, b.h + 0.45, 0]} castShadow>
        <boxGeometry args={[b.w * 1.05, 0.45, b.d * 1.05]} />
        <meshStandardMaterial map={roofMap} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* pitched roof accents for Chinese style */}
      {(b.id === "palace" || b.id === "library") && (
        <mesh position={[0, b.h + 1.15, 0]} castShadow rotation={[0, 0, 0]}>
          <coneGeometry args={[Math.min(b.w, b.d) * 0.55, 1.4, 4]} />
          <meshStandardMaterial map={roofMap} roughness={0.65} />
        </mesh>
      )}
      {/* entrance */}
      <mesh position={[0, 1.15, b.d * 0.46]} castShadow>
        <boxGeometry args={[Math.min(2.2, b.w * 0.35), 2.1, 0.35]} />
        <meshStandardMaterial color="#2a2420" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.35, b.d * 0.5]} castShadow>
        <boxGeometry args={[Math.min(2.8, b.w * 0.42), 0.22, 0.8]} />
        <meshStandardMaterial map={roofMap} roughness={0.7} />
      </mesh>
      <Html position={[0, b.h + 1.6, 0]} center distanceFactor={26} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(10,14,20,0.78)",
            color: "#eef3f8",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(94,228,168,0.4)",
            whiteSpace: "nowrap",
            fontFamily: "system-ui, PingFang TC, sans-serif",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          }}
        >
          {b.name}
        </div>
      </Html>
    </group>
  );
}

function Trees() {
  const trees = useMemo(() => {
    const list: { x: number; z: number; s: number; kind: number }[] = [];
    for (let ty = 2; ty < MAP_H - 2; ty += 2) {
      for (let tx = 2; tx < MAP_W - 2; tx += 3) {
        const t = tilesCache[ty * MAP_W + tx] ?? 0;
        if (t === 5 || t === 0 || t === 6) {
          if ((tx * 17 + ty * 11) % 4 === 0) {
            list.push({
              x: (tx - MAP_W / 2) * CELL + ((tx % 3) - 1) * 0.3,
              z: (ty - MAP_H / 2) * CELL + ((ty % 3) - 1) * 0.25,
              s: 0.75 + ((tx + ty) % 4) * 0.12,
              kind: (tx + ty) % 3,
            });
          }
        }
      }
    }
    return list.slice(0, 90);
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.16, 1.5, 7]} />
            <meshStandardMaterial color="#5c4332" roughness={0.95} />
          </mesh>
          {t.kind === 0 ? (
            <>
              <mesh position={[0, 2.15, 0]} castShadow>
                <sphereGeometry args={[1.05, 12, 10]} />
                <meshStandardMaterial color="#2f8a4a" roughness={0.85} />
              </mesh>
              <mesh position={[0.35, 2.5, 0.2]} castShadow>
                <sphereGeometry args={[0.7, 10, 8]} />
                <meshStandardMaterial color="#3a9c55" roughness={0.85} />
              </mesh>
            </>
          ) : t.kind === 1 ? (
            <>
              <mesh position={[0, 1.85, 0]} castShadow>
                <coneGeometry args={[0.95, 2.0, 8]} />
                <meshStandardMaterial color="#287844" roughness={0.88} />
              </mesh>
              <mesh position={[0, 2.75, 0]} castShadow>
                <coneGeometry args={[0.65, 1.35, 8]} />
                <meshStandardMaterial color="#349a52" roughness={0.88} />
              </mesh>
            </>
          ) : (
            <>
              {/* palm-ish */}
              <mesh position={[0, 2.4, 0]} castShadow rotation={[0.15, 0, 0]}>
                <sphereGeometry args={[0.55, 8, 6]} />
                <meshStandardMaterial color="#2d7a40" roughness={0.9} />
              </mesh>
              <mesh position={[0.5, 2.35, 0]} castShadow rotation={[0, 0, 0.6]}>
                <boxGeometry args={[1.1, 0.08, 0.35]} />
                <meshStandardMaterial color="#3a8f4c" />
              </mesh>
              <mesh position={[-0.45, 2.4, 0.15]} castShadow rotation={[0, 0.4, -0.55]}>
                <boxGeometry args={[1.0, 0.08, 0.32]} />
                <meshStandardMaterial color="#3a8f4c" />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function ScenicBackdrop() {
  const sky = useLoader(THREE.TextureLoader, "/textures/sky-campus.jpg");
  useMemo(() => {
    sky.colorSpace = THREE.SRGBColorSpace;
    sky.wrapS = THREE.RepeatWrapping;
    sky.wrapT = THREE.ClampToEdgeWrapping;
  }, [sky]);

  // cylindrical panorama around campus
  return (
    <group>
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[78, 78, 36, 48, 1, true]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} />
      </mesh>
      {/* distant hills silhouette */}
      <mesh position={[0, 1.2, -55]} rotation={[-0.05, 0, 0]}>
        <planeGeometry args={[140, 18]} />
        <meshStandardMaterial color="#4a7a4e" roughness={1} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[-40, 0.8, 40]} rotation={[0, 0.8, 0]}>
        <planeGeometry args={[60, 12]} />
        <meshStandardMaterial color="#5a8a58" roughness={1} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PhotoPlacards() {
  // scenic photo boards near landmarks (feel of real campus photography)
  const spots = useMemo(
    () => [
      { x: -28, z: -6, rot: 0.3, label: "宮燈大道風景" },
      { x: 18, z: -10, rot: -0.4, label: "圖書館廣場" },
      { x: 8, z: 6, rot: 1.1, label: "體育館外" },
      { x: 32, z: -4, rot: -0.9, label: "驚聲大樓" },
    ],
    [],
  );
  const photo = useLoader(THREE.TextureLoader, "/textures/sky-campus.jpg");
  useMemo(() => {
    photo.colorSpace = THREE.SRGBColorSpace;
  }, [photo]);

  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[0.08, 2.8, 0.08]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <boxGeometry args={[2.4, 1.55, 0.08]} />
            <meshStandardMaterial map={photo} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[0, 2.9, -0.05]}>
            <boxGeometry args={[2.55, 1.7, 0.05]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          <Html position={[0, 3.9, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "rgba(10,14,20,0.7)",
                color: "#cfe8d8",
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
            >
              📷 {s.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function PlayerMesh() {
  const ref = useRef<THREE.Group>(null);
  const player = useGame((s) => s.player);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(player.x, 0, player.z);
    ref.current.rotation.y = player.yaw;
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.7, 6, 12]} />
        <meshStandardMaterial color="#4a8fd4" roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#e8b896" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.95, -0.02]} castShadow>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#1a1a22" />
      </mesh>
      <mesh position={[0.12, 1.05, 0.28]} castShadow>
        <boxGeometry args={[0.12, 0.08, 0.04]} />
        <meshStandardMaterial color="#e8fff0" />
      </mesh>
      <mesh position={[0, 0.4, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.35, 6]} />
        <meshStandardMaterial color="#5ee4a8" emissive="#5ee4a8" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function NpcMesh({ n }: { n: Npc3 }) {
  const colors: Record<string, string> = {
    elder: "#5b8fd4",
    merchant: "#d4a05b",
    kid: "#7bc96f",
    librarian: "#6a8aaa",
    biz: "#8a7aaa",
    gym: "#5aaa7a",
    sac_staff: "#aa7aaa",
    bainen: "#e8a0b8",
  };
  const col = colors[n.id] ?? "#8fa0b3";
  const pulse = n.id === "bainen";

  return (
    <group position={[n.x, 0, n.z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.65, 4, 10]} />
        <meshStandardMaterial color={col} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color="#e8c4a8" />
      </mesh>
      {pulse && (
        <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.03, 8, 24]} />
          <meshStandardMaterial color="#5ee4a8" emissive="#5ee4a8" emissiveIntensity={0.6} transparent opacity={0.7} />
        </mesh>
      )}
      <Html position={[0, 2.35, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(10,14,20,0.75)",
            color: n.id === "bainen" ? "#f0a0c0" : "#eef3f8",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {n.name}
        </div>
      </Html>
      {(n.questId === "shadow_king" || n.questId === "slime_hunt" || n.id === "bainen") && (
        <mesh position={[0, 2.7, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#f5d76e" emissive="#f5d76e" emissiveIntensity={0.7} />
        </mesh>
      )}
    </group>
  );
}

function EnemyMesh({ e }: { e: Enemy3 }) {
  if (e.dead) return null;
  const scale = e.boss ? 1.6 : e.kind === "goblin" ? 1.15 : 0.85;
  const color = e.boss ? "#8a5cff" : e.kind === "goblin" ? "#6aaa4a" : "#5ed47a";
  const y = e.kind === "slime" ? 0.4 * scale : 0.7 * scale;

  return (
    <group position={[e.x, 0, e.z]} scale={scale}>
      {e.kind === "slime" ? (
        <mesh position={[0, y, 0]} castShadow>
          <sphereGeometry args={[0.45, 16, 12]} />
          <meshStandardMaterial
            color={e.hitFlash > 0 ? "#ffffff" : color}
            roughness={0.35}
            emissive={e.hitFlash > 0 ? "#ffffff" : "#000000"}
            emissiveIntensity={e.hitFlash > 0 ? 0.5 : 0}
          />
        </mesh>
      ) : (
        <>
          <mesh position={[0, y, 0]} castShadow>
            <capsuleGeometry args={[0.35, 0.55, 4, 10]} />
            <meshStandardMaterial color={e.hitFlash > 0 ? "#ffffff" : color} roughness={0.55} />
          </mesh>
          <mesh position={[0, y + 0.7, 0]} castShadow>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial color={e.boss ? "#3a2060" : "#4a6a30"} />
          </mesh>
        </>
      )}
      {e.boss && (
        <Html position={[0, 2.8, 0]} center distanceFactor={24} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(80,40,120,0.85)",
              color: "#e0c3ff",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 8,
              whiteSpace: "nowrap",
            }}
          >
            挑戰王 張哲維
          </div>
        </Html>
      )}
      {(e.hp < e.maxHp || e.boss) && (
        <Html position={[0, e.boss ? 3.2 : 1.8, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
          <div style={{ width: 48, height: 5, background: "rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${(e.hp / e.maxHp) * 100}%`,
                height: "100%",
                background: e.boss ? "#c77dff" : "#ef6b6b",
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
}

function CompanionMesh() {
  const companion = useGame((s) => s.companion);
  const flags = useGame((s) => s.flags);
  if (!companion || !flags.companion) return null;
  return (
    <group position={[companion.x, 0, companion.z]} rotation={[0, companion.yaw, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.6, 4, 10]} />
        <meshStandardMaterial color="#e8a0b8" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#e8c4a8" />
      </mesh>
      <Html position={[0, 2.2, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(10,14,20,0.75)",
            color: "#f0a0c0",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          柏能學長
        </div>
      </Html>
    </group>
  );
}

function ObjectiveMarker() {
  const label = useGame((s) => s.objective?.label ?? null);
  const ox = useGame((s) => s.objective?.x ?? 0);
  const oz = useGame((s) => s.objective?.z ?? 0);
  const objective = label ? { label, x: ox, z: oz } : null;
  const player = useGame((s) => s.player);
  const bob = useRef(0);
  useFrame((_, dt) => {
    bob.current += dt * 3;
  });
  if (!objective) return null;
  const dist = Math.hypot(objective.x - player.x, objective.z - player.z);
  if (dist < 2.5) return null;
  const yBob = Math.sin(bob.current) * 0.15;
  return (
    <group position={[objective.x, 0, objective.z]}>
      <mesh position={[0, 2.5 + yBob, 0]}>
        <coneGeometry args={[0.35, 0.7, 4]} />
        <meshStandardMaterial color="#5ee4a8" emissive="#5ee4a8" emissiveIntensity={0.5} />
      </mesh>
      <Html position={[0, 3.6 + yBob, 0]} center distanceFactor={28} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(20,40,30,0.82)",
            color: "#9dffa8",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            border: "1px solid rgba(94,228,168,0.4)",
          }}
        >
          ✦ {objective.label}
        </div>
      </Html>
    </group>
  );
}

function FollowCamera() {
  const { camera } = useThree();
  const player = useGame((s) => s.player);
  const camYaw = useGame((s) => s.camYaw);
  const ideal = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const curYaw = useRef(0);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    // smooth camera yaw
    let dy = camYaw - curYaw.current;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    curYaw.current += dy * (1 - Math.exp(-8 * d));

    const dist = 8.2;
    const height = 5.6;
    const fx = -Math.sin(curYaw.current);
    const fz = -Math.cos(curYaw.current);
    ideal.current.set(player.x - fx * dist, height, player.z - fz * dist);
    camera.position.lerp(ideal.current, 1 - Math.exp(-6 * d));
    look.current.set(player.x, 1.15, player.z);
    camera.lookAt(look.current);
  });

  return null;
}

function GameLoop() {
  const tick = useGame((s) => s.tick);
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.05));
  });
  return null;
}

function StreetLamps() {
  const lamps = useMemo(() => {
    const list: { x: number; z: number }[] = [];
    for (let tx = 6; tx < MAP_W - 4; tx += 6) {
      for (const ty of [15, 16]) {
        if (!isSolidTile(tilesCache[ty * MAP_W + tx]!)) {
          list.push({
            x: (tx - MAP_W / 2) * CELL,
            z: (ty - MAP_H / 2) * CELL + 1.2,
          });
        }
      }
    }
    return list.slice(0, 20);
  }, []);
  return (
    <group>
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.4, 6]} />
            <meshStandardMaterial color="#555" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#ffd070" emissiveIntensity={0.9} />
          </mesh>
          <pointLight position={[0, 2.5, 0]} intensity={0.4} distance={9} color="#ffe6b0" />
        </group>
      ))}
    </group>
  );
}

function TexturedCampus() {
  const stone = useLoader(THREE.TextureLoader, "/textures/facade-stone.jpg");
  const brick = useLoader(THREE.TextureLoader, "/textures/facade-brick.jpg");
  const roof = useLoader(THREE.TextureLoader, "/textures/roof-tile.jpg");
  useMemo(() => {
    for (const t of [stone, brick, roof]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
  }, [stone, brick, roof]);

  const buildings = useGame((s) => s.buildings);
  return (
    <>
      {buildings.map((b) => (
        <BuildingMesh key={b.id} b={b} stone={stone} brick={brick} roof={roof} />
      ))}
    </>
  );
}

export function CampusScene() {
  const npcs = useGame((s) => s.npcs);
  const enemies = useGame((s) => s.enemies);
  const phase = useGame((s) => s.phase);

  useEffect(() => {
    window.__controlsTest = {
      getYaw: () => useGame.getState().player.yaw,
      getSpeed: () => 0,
      getPos: () => {
        const p = useGame.getState().player;
        return { x: p.x, y: p.z };
      },
      getFacing: () => useGame.getState().player.facing,
      setKeys: (codes: string[]) => {
        const st = useGame.getState();
        st.keys.clear();
        for (const c of codes) st.keys.add(c);
      },
      getKeys: () => [...useGame.getState().keys],
    };
    window.__game = {
      get phase() {
        return useGame.getState().phase;
      },
      get player() {
        return useGame.getState().player;
      },
      get enemies() {
        return useGame.getState().enemies;
      },
      get npcs() {
        return useGame.getState().npcs;
      },
      get flags() {
        return useGame.getState().flags;
      },
      get touch() {
        return useGame.getState().touch;
      },
      setTouch(x: number, y: number) {
        useGame.getState().setTouch(x, y);
      },
      talkToNpc(npc: Npc3) {
        const st = useGame.getState();
        st.player.x = npc.x;
        st.player.z = npc.z;
        st.queueInteract();
        st.tick(0.016);
      },
      advanceDialogue: () => useGame.getState().advanceDialogue(),
      startNewGame: () => useGame.getState().initNew(),
      setPhase: (p: string) => useGame.getState().setPhase(p as never),
      forceBossDead() {
        const st = useGame.getState();
        const enemies = st.enemies.map((e) =>
          e.boss ? { ...e, hp: 0, dead: true } : e,
        );
        useGame.setState({
          enemies,
          flags: { ...st.flags, boss_dead: true },
          toast: "挑戰通過！快去找柏能學長",
          toastT: 3,
        });
      },
      getStamps: () => useGame.getState().stamps,
      getQuests: () => useGame.getState().quests,
      getObjective: () => useGame.getState().objective,
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#9ec8e8"]} />
      <fog attach="fog" args={["#b8d4ea", 42, 105]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        castShadow
        position={[28, 42, 18]}
        intensity={1.35}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={120}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        color="#fff4e0"
      />
      <hemisphereLight args={["#b8d8ff", "#6a8a55", 0.4]} />
      <Sky sunPosition={[80, 35, 40]} turbidity={3.5} rayleigh={0.9} mieCoefficient={0.004} />

      <ScenicBackdrop />
      <Ground />
      <ContactShadows opacity={0.32} scale={130} blur={2.2} far={10} color="#1a2a18" />
      <Trees />
      <StreetLamps />
      <PhotoPlacards />
      <TexturedCampus />
      {npcs.map((n) => (
        <NpcMesh key={n.id} n={n} />
      ))}
      {enemies.map((e) => (
        <EnemyMesh key={e.id} e={e} />
      ))}
      {(phase === "playing" || phase === "dialogue" || phase === "inventory" || phase === "paused") && (
        <>
          <PlayerMesh />
          <CompanionMesh />
          <ObjectiveMarker />
        </>
      )}
      <FollowCamera />
      <GameLoop />
    </>
  );
}

declare global {
  interface Window {
    __game?: unknown;
    __controlsTest?: unknown;
  }
}
