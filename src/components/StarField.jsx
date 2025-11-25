// src/components/StarField.jsx
import React, { useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import * as THREE from "three";
import { supabase } from "../lib/supabase";

const SCALE = 0.6;

// ✨ Pulsirajući prsten oko claimed zvijezda
const ClaimedRing = ({ position }) => {
  const ref = React.useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const s = 1.4 + Math.sin(t * 2) * 0.15;
    ref.current.scale.setScalar(s);
    ref.current.material.opacity = 0.4 + 0.2 * Math.sin(t * 2);
  });

  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.18, 0.28, 24]} />
      <meshBasicMaterial
        color="#fbbf24"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const colorForStar = (star) => {
  if (!star.is_claimed) {
    return "#64748b";
  }

  switch (star.color) {
    case "cyan":
      return "#22d3ee";
    case "indigo":
      return "#6366f1";
    case "fuchsia":
      return "#e879f9";
    case "amber":
      return "#fbbf24";
    case "emerald":
      return "#34d399";
    default:
      return "#facc15";
  }
};

const StarField = ({ onStarClick, onStarHover, onStarsLoaded, reloadKey }) => {
  const [stars, setStars] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [globalOpacity, setGlobalOpacity] = useState(0);

  useCursor(!!hoveredId);

  useEffect(() => {
    let ignore = false;

    const loadStars = async () => {
      const { data, error } = await supabase
        .from("stars")
        .select("id, x, y, z, is_claimed, color, message, owner_name")
        .order("id", { ascending: true })
        .limit(3000);

      if (error) {
        console.error("Error loading stars:", error);
        return;
      }

      if (!ignore) {
        const list = data || [];
        setStars(list);
        setGlobalOpacity(0);
        if (onStarsLoaded) onStarsLoaded(list);
      }
    };

    loadStars();

    return () => {
      ignore = true;
    };
  }, [reloadKey, onStarsLoaded]);

  useFrame((_, delta) => {
    setGlobalOpacity((prev) => {
      if (prev >= 1) return prev;
      const next = Math.min(1, prev + delta * 0.7);
      return next;
    });
  });

  return (
    <group>
      {stars.map((star) => {
        const pos = [star.x * SCALE, star.y * SCALE, star.z * SCALE];
        const baseColor = colorForStar(star);
        const size = star.is_claimed ? 0.12 : 0.08;

        return (
          <group key={star.id}>
            {star.is_claimed && <ClaimedRing position={pos} />}
            <mesh
              position={pos}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredId(star.id);
                if (onStarHover) onStarHover(star);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredId((current) =>
                  current === star.id ? null : current
                );
                if (onStarHover) onStarHover(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onStarClick && onStarClick(star);
              }}
            >
              <sphereGeometry args={[size, 12, 12]} />
              <meshBasicMaterial
                color={baseColor}
                transparent
                opacity={0.15 + globalOpacity * 0.85}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default StarField;
