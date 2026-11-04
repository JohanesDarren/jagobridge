import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The JagoBridge mark, extruded.
 *
 * The geometry is derived from the same path data as <Logo /> (and therefore
 * the favicon), so the 3D badge cannot drift from the flat brand mark:
 *
 *   viewBox      0 0 32 32
 *   plate        rect 32x32, rx 8, fill #0d26de
 *   arch         M7 20 c0-4 3-7 9-7 s9 3 9 7   (stroke 2.5, round caps)
 *   deck         M7 24 h18                      (stroke 2.5, round caps)
 *
 * SVG space is 32 units, y-down. `toWorld` maps it to a centred 1x1 badge with
 * y-up, which is what the 3D scene needs.
 */

const SVG_UNITS = 32;
const HALF = SVG_UNITS / 2;
const STROKE = 2.5;
const PLATE_RADIUS = 8;

/** SVG point -> world point (centred, y flipped). */
function toWorld(x: number, y: number): [number, number] {
  return [(x - HALF) / SVG_UNITS, -(y - HALF) / SVG_UNITS];
}

/** Stroke width -> tube radius. */
const TUBE_RADIUS = STROKE / 2 / SVG_UNITS;

function buildArchCurve(): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();

  // M7 20 C 7 16, 10 13, 16 13
  const [x0, y0] = toWorld(7, 20);
  const [c1x, c1y] = toWorld(7, 16);
  const [c2x, c2y] = toWorld(10, 13);
  const [ax, ay] = toWorld(16, 13);

  path.add(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(x0, y0, 0),
      new THREE.Vector3(c1x, c1y, 0),
      new THREE.Vector3(c2x, c2y, 0),
      new THREE.Vector3(ax, ay, 0),
    ),
  );

  // S 25 16, 25 20
  // The first control point of an SVG `s` command is the reflection of the
  // previous segment's second control point about the current point:
  //   2 * (16,13) - (10,13) = (22,13)
  const [c3x, c3y] = toWorld(2 * 16 - 10, 13);
  const [c4x, c4y] = toWorld(25, 16);
  const [x1, y1] = toWorld(25, 20);

  path.add(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(ax, ay, 0),
      new THREE.Vector3(c3x, c3y, 0),
      new THREE.Vector3(c4x, c4y, 0),
      new THREE.Vector3(x1, y1, 0),
    ),
  );

  return path;
}

function roundedSquareShape(size: number, radius: number): THREE.Shape {
  const s = size / 2;
  const r = Math.min(radius, s);
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  shape.closePath();
  return shape;
}

function Mark({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);

  const plateDepth = 0.17;
  const faceZ = plateDepth / 2;

  const plateGeometry = useMemo(() => {
    const shape = roundedSquareShape(1, PLATE_RADIUS / SVG_UNITS);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: plateDepth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 24,
    });
    // ExtrudeGeometry builds from z=0 forward; centre it on the origin.
    geometry.translate(0, 0, -plateDepth / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const archGeometry = useMemo(() => {
    const curve = buildArchCurve();
    const geometry = new THREE.TubeGeometry(curve, 96, TUBE_RADIUS, 14, false);
    geometry.translate(0, 0, faceZ);
    return geometry;
  }, [faceZ]);

  const deckGeometry = useMemo(() => {
    const [x0, y] = toWorld(7, 24);
    const [x1] = toWorld(25, 24);
    const geometry = new THREE.CapsuleGeometry(TUBE_RADIUS, Math.abs(x1 - x0), 6, 14);
    // CapsuleGeometry runs along Y; lay it along X for the deck.
    geometry.rotateZ(Math.PI / 2);
    geometry.translate((x0 + x1) / 2, y, faceZ);
    return geometry;
  }, [faceZ]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const time = state.clock.getElapsedTime();

    // Continuous looping motion: a slow figure-of-eight tilt plus a bob, so the
    // badge is always moving but never snaps at the loop boundary.
    if (!reducedMotion) {
      const targetY = Math.sin(time * 0.7) * 0.5;
      const targetX = Math.sin(time * 0.45) * 0.16;
      const targetZ = Math.sin(time * 0.35) * 0.1;

      group.current.rotation.y += (targetY + state.pointer.x * 0.35 - group.current.rotation.y) * Math.min(1, delta * 4);
      group.current.rotation.x += (targetX - group.current.rotation.x) * Math.min(1, delta * 4);
      group.current.rotation.z += (targetZ + state.pointer.x * 0.12 - group.current.rotation.z) * Math.min(1, delta * 4);
      group.current.position.y = Math.sin(time * 1.1) * 0.055;
    } else {
      group.current.rotation.y += (state.pointer.x * 0.3 - group.current.rotation.y) * Math.min(1, delta * 3);
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={plateGeometry} castShadow>
        <meshStandardMaterial
          color="#0d26de"
          metalness={0.45}
          roughness={0.26}
          emissive="#0a1a8f"
          emissiveIntensity={0.28}
        />
      </mesh>

      <mesh geometry={archGeometry}>
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.25}
          roughness={0.2}
          emissive="#dbe6fe"
          emissiveIntensity={0.22}
        />
      </mesh>

      <mesh geometry={deckGeometry}>
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.25}
          roughness={0.2}
          emissive="#dbe6fe"
          emissiveIntensity={0.22}
        />
      </mesh>
    </group>
  );
}

export function Logo3D({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 2.55], fov: 40 }}
      style={{ width: 132, height: 132 }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-3.5, -1, 2.5]} intensity={0.75} color="#7dd3fc" />
      <pointLight position={[0, 0, 2.2]} intensity={7} distance={8} color="#bfd3fe" />
      <Mark reducedMotion={reducedMotion} />
    </Canvas>
  );
}
