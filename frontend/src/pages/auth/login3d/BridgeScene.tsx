import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Environment, Float, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PROVIDERS, createProviderTexture, type ProviderBrand } from "./providers";

/**
 * Decorative 3D scene for the login screen.
 *
 * A suspension bridge carries the provider tiles: the deck spans the viewport,
 * the two towers frame the login card, and the tiles ride the main span on both
 * sides so the centre of the screen stays clear for the form.
 *
 * Everything here is procedural (no model downloads, no HDR fetch) so the page
 * has no extra network dependency and renders offline.
 */

const TOWER_X = 6.6;
const TOWER_TOP = 6.4;
/** The deck sits low so the card overlaps sky, not the bridge span. */
const DECK_Y = -1.45;
const CABLE_Z = 0.95;
const ANCHOR_X = 15.5;
const CABLE_SAG = 4.1;

/** Y of the main-span cable at a given x (parabola approximating a catenary). */
function cableY(x: number): number {
  const t = Math.min(Math.abs(x) / TOWER_X, 1);
  return TOWER_TOP - CABLE_SAG * (1 - t * t);
}

function buildCablePoints(z: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const steps = 90;
  const anchorY = DECK_Y + 0.35;

  // Left side span: anchor -> left tower top.
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = -ANCHOR_X + (ANCHOR_X - TOWER_X) * t;
    const y = anchorY + (TOWER_TOP - anchorY) * Math.pow(t, 0.82);
    points.push(new THREE.Vector3(x, y, z));
  }
  // Main span: left tower -> right tower.
  for (let i = 1; i < steps; i += 1) {
    const x = -TOWER_X + (2 * TOWER_X * i) / steps;
    points.push(new THREE.Vector3(x, cableY(x), z));
  }
  // Right side span: right tower top -> anchor.
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = TOWER_X + (ANCHOR_X - TOWER_X) * t;
    const y = TOWER_TOP - (TOWER_TOP - anchorY) * Math.pow(t, 0.82);
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

/* ------------------------------------------------------------------ STRUCTURE */

function Deck() {
  return (
    <group>
      <RoundedBox args={[ANCHOR_X * 2 + 1.4, 0.34, 2.7]} radius={0.08} smoothness={3} position={[0, DECK_Y, 0]}>
        <meshStandardMaterial color="#16233c" metalness={0.65} roughness={0.42} />
      </RoundedBox>

      {/* Lighter running surface so the deck reads as a road from a distance. */}
      <mesh position={[0, DECK_Y + 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ANCHOR_X * 2, 2.15]} />
        <meshStandardMaterial color="#22334f" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Centre line dashes */}
      {Array.from({ length: 22 }, (_, i) => (
        <mesh
          key={`dash-${i}`}
          position={[-12.5 + i * 1.2, DECK_Y + 0.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.55, 0.075]} />
          <meshBasicMaterial color="#7fa6d8" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Edge beams */}
      {[-1.28, 1.28].map((z) => (
        <mesh key={`edge-${z}`} position={[0, DECK_Y + 0.06, z]}>
          <boxGeometry args={[ANCHOR_X * 2 + 1.4, 0.1, 0.16]} />
          <meshStandardMaterial color="#0f1a2e" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Tower({ x }: { x: number }) {
  const legZ = 0.95;
  const legBottom = DECK_Y - 1.1;
  const legHeight = TOWER_TOP - legBottom;
  return (
    <group position={[x, 0, 0]}>
      {[-legZ, legZ].map((z) => (
        <group key={`leg-${z}`} position={[0, 0, z]}>
          <mesh position={[0, legBottom + legHeight / 2, 0]}>
            <boxGeometry args={[0.42, legHeight, 0.42]} />
            <meshStandardMaterial color="#1c2c47" metalness={0.72} roughness={0.38} />
          </mesh>
          {/* Cable saddle */}
          <mesh position={[0, TOWER_TOP, 0]}>
            <boxGeometry args={[0.6, 0.3, 0.6]} />
            <meshStandardMaterial
              color="#4d7fc4"
              metalness={0.9}
              roughness={0.25}
              emissive="#1b3a63"
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      ))}

      {/* Cross beams */}
      {[DECK_Y + 2.4, TOWER_TOP - 0.15].map((y) => (
        <mesh key={`beam-${y}`} position={[0, y, 0]}>
          <boxGeometry args={[0.3, 0.28, legZ * 2]} />
          <meshStandardMaterial color="#22334f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Cables({ reducedMotion }: { reducedMotion: boolean }) {
  const curves = useMemo(
    () => [buildCablePoints(-CABLE_Z), buildCablePoints(CABLE_Z)].map(
      (points) => new THREE.CatmullRomCurve3(points),
    ),
    [],
  );

  const tubes = useMemo(
    () =>
      curves.map(
        (curve) => new THREE.TubeGeometry(curve, 220, 0.045, 8, false),
      ),
    [curves],
  );

  useEffect(() => () => tubes.forEach((t) => t.dispose()), [tubes]);

  // Vertical suspenders across the main span, both sides.
  const suspenders = useMemo(() => {
    const out: Array<{ x: number; y: number; h: number }> = [];
    const step = 1.15;
    for (let x = -TOWER_X + step; x < TOWER_X - step * 0.5; x += step) {
      const y = cableY(x);
      out.push({ x, y, h: y - DECK_Y });
    }
    return out;
  }, []);

  const suspenderGeometry = useMemo(() => new THREE.CylinderGeometry(0.018, 0.018, 1, 5), []);
  const suspenderMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8fb4e0", metalness: 0.85, roughness: 0.3 }),
    [],
  );

  const packets = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (reducedMotion || !packets.current) return;
    const time = state.clock.getElapsedTime();
    packets.current.children.forEach((child, index) => {
      const offset = index / packets.current!.children.length;
      const t = (offset + time * 0.045) % 1;
      const curve = curves[index % curves.length];
      const point = curve.getPointAt(t);
      child.position.set(point.x, point.y + 0.02, point.z);
    });
  });

  return (
    <group>
      {tubes.map((geometry, index) => (
        <mesh key={`cable-${index}`} geometry={geometry}>
          <meshStandardMaterial color="#a9c8ea" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}

      {suspenders.map((s, index) =>
        [-CABLE_Z, CABLE_Z].map((z) => (
          <mesh
            key={`sus-${index}-${z}`}
            geometry={suspenderGeometry}
            material={suspenderMaterial}
            position={[s.x, DECK_Y + s.h / 2 + 0.1, z]}
            scale={[1, s.h, 1]}
          />
        )),
      )}

      {/* Data packets sliding along the cables — the "gateway traffic" cue. */}
      <group ref={packets}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={`packet-${i}`}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshBasicMaterial color={i % 2 === 0 ? "#7dd3fc" : "#a5b4fc"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* --------------------------------------------------------------- PROVIDER TILES */

function ProviderTile({
  brand,
  position,
  reducedMotion,
  index,
}: {
  brand: ProviderBrand;
  position: [number, number, number];
  reducedMotion: boolean;
  index: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createProviderTexture(brand), [brand]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    if (reducedMotion || !mesh.current) return;
    const time = state.clock.getElapsedTime();
    // Slow billboard-ish sway so tiles always present their face to the viewer.
    mesh.current.rotation.y = Math.sin(time * 0.42 + index * 1.7) * 0.3;
    mesh.current.rotation.z = Math.sin(time * 0.31 + index * 2.1) * 0.05;
    if (halo.current) {
      const pulse = 0.2 + Math.sin(time * 0.9 + index) * 0.05;
      (halo.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  return (
    <Float
      speed={reducedMotion ? 0 : 1.35}
      rotationIntensity={reducedMotion ? 0 : 0.16}
      floatIntensity={reducedMotion ? 0 : 0.55}
      floatingRange={[-0.09, 0.09]}
    >
      <group position={position}>
        <mesh ref={mesh}>
          <boxGeometry args={[1.15, 1.15, 0.12]} />
          <meshStandardMaterial
            map={texture}
            metalness={0.2}
            roughness={0.32}
            color="#c9d4e8"
            emissive="#ffffff"
            emissiveMap={texture}
            emissiveIntensity={0.34}
            toneMapped={false}
          />
        </mesh>
        {/* Soft backing glow so tiles separate from the dark background. */}
        <mesh ref={halo} position={[0, 0, -0.1]}>
          <planeGeometry args={[1.9, 1.9]} />
          <meshBasicMaterial color="#4f8cf0" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}

/**
 * Lays the tiles in two staggered rows either side of centre.
 *
 * The bounds are not arbitrary. At this camera the frustum is ~12 world units
 * half-width at the tiles' depth, and the login card covers ±3.8. Because a
 * tile sits further from the camera at negative z, its screen footprint grows,
 * so the inner edge has to clear the card at the *deepest* z, not the nearest.
 * INNER/OUTER below are the values that keep every tile fully on screen and
 * clear of the card at the same time.
 *
 * Adding providers to PROVIDERS automatically extends the formation.
 */
function ProviderField({ reducedMotion }: { reducedMotion: boolean }) {
  const placements = useMemo(() => {
    const total = PROVIDERS.length;
    const half = Math.ceil(total / 2);
    const left = PROVIDERS.slice(0, half);
    const right = PROVIDERS.slice(half);

    const INNER = 5.45;
    const OUTER = 9.4;

    const build = (brands: ProviderBrand[], side: -1 | 1) => {
      const top = brands.filter((_, i) => i % 2 === 0);
      const bottom = brands.filter((_, i) => i % 2 === 1);

      const place = (group: ProviderBrand[], y: number, count: number, phase: number) =>
        group.map((brand, i) => {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const x = side * (INNER + t * (OUTER - INNER));
          const drift = Math.sin(t * Math.PI + phase) * 0.14;
          // Keep the depth spread small: large z pushes inner tiles behind the card.
          const z = (i % 2 === 0 ? 1 : -1) * 0.25;
          return { brand, position: [x, y + drift, z] as [number, number, number] };
        });

      return [...place(top, 3.42, top.length, 0.4), ...place(bottom, 2.0, bottom.length, 2.1)];
    };

    return [...build(left, -1), ...build(right, 1)];
  }, []);

  return (
    <group>
      {placements.map((p, index) => (
        <ProviderTile
          key={p.brand.id}
          brand={p.brand}
          position={p.position}
          reducedMotion={reducedMotion}
          index={index}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ CAMERA RIG */

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3(0, 2.1, 0));

  useFrame((_, delta) => {
    const damp = 1 - Math.pow(0.001, delta);
    const parallax = reducedMotion ? 0 : 1;
    const desiredX = pointer.x * 1.15 * parallax;
    const desiredY = 3.05 + pointer.y * 0.5 * parallax;

    camera.position.x += (desiredX - camera.position.x) * damp;
    camera.position.y += (desiredY - camera.position.y) * damp;
    camera.lookAt(target.current);
  });

  return null;
}

/* ----------------------------------------------------------------------- SCENE */

export function BridgeScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 3.05, 15.2], fov: 42, near: 0.1, far: 90 }}
      style={{ pointerEvents: "none" }}
    >
      <color attach="background" args={["#070d1b"]} />
      <fog attach="fog" args={["#070d1b", 20, 42]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 12, 8]} intensity={1.15} color="#cfe2ff" />
      <directionalLight position={[-8, 6, -6]} intensity={0.55} color="#5b7cff" />
      <pointLight position={[0, 4.5, 6]} intensity={22} distance={26} color="#4f7dff" />

      <Deck />
      <Tower x={-TOWER_X} />
      <Tower x={TOWER_X} />
      <Cables reducedMotion={reducedMotion} />
      <ProviderField reducedMotion={reducedMotion} />

      {/* Cheap studio lighting via drei — renders to a cube target, no HDR file. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2.4} position={[0, 8, 6]} scale={[12, 6, 1]} color="#9db9ff" />
        <Lightformer form="rect" intensity={1.5} position={[-8, 3, 4]} scale={[6, 8, 1]} color="#5f7bff" />
        <Lightformer form="rect" intensity={1.2} position={[8, 3, 4]} scale={[6, 8, 1]} color="#7dd3fc" />
      </Environment>

      <CameraRig reducedMotion={reducedMotion} />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
