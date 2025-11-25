// src/components/SolarSystem.jsx
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";

const PLANETS = [
  {
    name: "Mercury",
    distance: 7,
    size: 0.4,
    color: "#b1b1b1",
    orbitSpeed: 1.6,
    rotationSpeed: 1.5,
  },
  {
    name: "Venus",
    distance: 9,
    size: 0.7,
    color: "#d9b26f",
    orbitSpeed: 1.2,
    rotationSpeed: 1.2,
  },
  {
    name: "Earth",
    distance: 11,
    size: 0.75,
    color: "#4f9df7",
    orbitSpeed: 1,
    rotationSpeed: 1.8,
  },
  {
    name: "Mars",
    distance: 13,
    size: 0.6,
    color: "#d26b47",
    orbitSpeed: 0.8,
    rotationSpeed: 1.6,
  },
  {
    name: "Jupiter",
    distance: 17,
    size: 1.8,
    color: "#e0c29c",
    orbitSpeed: 0.4,
    rotationSpeed: 2.2,
  },
  {
    name: "Saturn",
    distance: 21,
    size: 1.5,
    color: "#e6d7a8",
    orbitSpeed: 0.3,
    rotationSpeed: 2.0,
    hasRings: true,
  },
  {
    name: "Uranus",
    distance: 25,
    size: 1.1,
    color: "#9bd7ff",
    orbitSpeed: 0.25,
    rotationSpeed: 1.7,
  },
  {
    name: "Neptune",
    distance: 29,
    size: 1.1,
    color: "#4976ff",
    orbitSpeed: 0.2,
    rotationSpeed: 1.7,
  },
];

function Planet({ distance, size, color, orbitSpeed, rotationSpeed, hasRings }) {
  const orbitRef = useRef();
  const planetRef = useRef();

  useFrame((_, delta) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y += orbitSpeed * delta;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y += rotationSpeed * delta;
    }
  });

  return (
    <group ref={orbitRef}>
      {/* orbita – tanka kružnica */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[distance - 0.02, distance + 0.02, 64]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.4} />
      </mesh>

      {/* planeta */}
      <mesh
        ref={planetRef}
        position={[distance, 0, 0]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive="#111827"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Saturnovi prsteni */}
      {hasRings && (
        <mesh position={[distance, 0, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[size * 1.4, size * 2.2, 64]} />
          <meshStandardMaterial
            color="#f5e6c8"
            emissive="#4b5563"
            transparent
            opacity={0.8}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}

const SolarSystem = () => {
  const sunRef = useRef();

  useFrame((_, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.2 * delta;
    }
  });

  return (
    <>
      {/* pozadinske zvijezde */}
      <Stars
        radius={200}
        depth={60}
        count={4000}
        factor={4}
        saturation={0}
        fade
        speed={0.4}
      />

      {/* Sunce + glavna svjetlost */}
      <mesh ref={sunRef} position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[3, 48, 48]} />
        <meshStandardMaterial
          emissive="#facc15"
          emissiveIntensity={1.8}
          color="#fde68a"
        />
      </mesh>

      <pointLight
        position={[0, 0, 0]}
        intensity={3.5}
        distance={200}
        color="#facc15"
        castShadow
      />

      {/* lagano ambijentalno svjetlo */}
      <ambientLight intensity={0.2} />

      {/* svi planeti */}
      {PLANETS.map((p) => (
        <Planet key={p.name} {...p} />
      ))}
    </>
  );
};

export default SolarSystem;
