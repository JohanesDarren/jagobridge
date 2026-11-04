import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The JagoBridge mark as a small extruded 3D badge, floating above the form.
 * Same artwork as <Logo /> (a bridge arch over a deck) so the brand stays
 * consistent with the rest of the app.
 */
function Mark({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const arch = useRef<THREE.Mesh>(null);
  const deck = useRef<THREE.Mesh>(null);

  const archGeometry = useRef<THREE.TubeGeometry | null>(null);
  if (!archGeometry.current) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.42, -0.1, 0),
      new THREE.Vector3(0, 0.62, 0),
      new THREE.Vector3(0.42, -0.1, 0),
    );
    archGeometry.current = new THREE.TubeGeometry(curve, 48, 0.075, 12, false);
  }

  useFrame((state, delta) => {
    if (!group.current) return;
    const time = state.clock.getElapsedTime();
    if (!reducedMotion) {
      group.current.rotation.y = Math.sin(time * 0.55) * 0.42;
      group.current.position.y = Math.sin(time * 0.9) * 0.045;
    }
    // Gentle idle tilt toward the pointer.
    const tilt = reducedMotion ? 0 : state.pointer.x * 0.28;
    group.current.rotation.z += (tilt - group.current.rotation.z) * Math.min(1, delta * 3);
  });

  return (
    <group ref={group}>
      {/* Backing plate */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[1.16, 1.16, 0.18]} />
        <meshStandardMaterial
          color="#0d26de"
          metalness={0.55}
          roughness={0.28}
          emissive="#0a1d9e"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Arch */}
      <mesh ref={arch} geometry={archGeometry.current ?? undefined}>
        <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.22} emissive="#dbe6fe" emissiveIntensity={0.25} />
      </mesh>

      {/* Deck */}
      <mesh ref={deck} position={[0, -0.34, 0]}>
        <boxGeometry args={[1.0, 0.115, 0.13]} />
        <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.22} emissive="#dbe6fe" emissiveIntensity={0.25} />
      </mesh>

      {/* Two piers under the deck */}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, -0.47, 0]}>
          <boxGeometry args={[0.085, 0.2, 0.12]} />
          <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function Logo3D({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 3.1], fov: 40 }}
      style={{ width: 132, height: 132 }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, -1, 3]} intensity={0.7} color="#7dd3fc" />
      <pointLight position={[0, 0, 3]} intensity={9} distance={9} color="#bfd3fe" />
      <Mark reducedMotion={reducedMotion} />
    </Canvas>
  );
}
