'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Sphere } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function LiquidBlob() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.rotation.x += delta * 0.08;
    mesh.rotation.y += delta * 0.12;
    const t = state.clock.elapsedTime;
    mesh.scale.setScalar(1 + Math.sin(t * 0.65) * 0.045);
  });

  return (
    <Float speed={0.5} rotationIntensity={0.12} floatIntensity={0.2}>
      <Sphere ref={ref} args={[1.3, 64, 64]} scale={[1.55, 0.55, 0.7]} position={[0.5, -0.15, 0]}>
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={0.8}
          chromaticAberration={0.06}
          anisotropy={0.25}
          roughness={0.12}
          transmission={0.95}
          ior={1.32}
          distortion={0.22}
          distortionScale={0.35}
          temporalDistortion={0.08}
          color="#d6ff69"
        />
      </Sphere>
    </Float>
  );
}

export default function LiquidField() {
  return (
    <div className="liquid-field" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[3, 2, 4]} intensity={4} color="#ffffff" />
        <pointLight position={[-3, 0, 2]} intensity={7} color="#67e8ff" />
        <pointLight position={[2, -1, 2]} intensity={6} color="#b794ff" />
        <LiquidBlob />
      </Canvas>
    </div>
  );
}
