// src/components/StarField.jsx
import React, { useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useCursor } from "@react-three/drei";
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
    // free star – hladniji ton
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

const StarField = ({ onStarClick, reloadKey }) => {
  const [stars, setStars] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [globalOpacity, setGlobalOpacity] = useState(0); // za fade-in

  useCursor(!!hoveredId);

  // učitaj zvijezde iz Supabase
  useEffect(() => {
    let ignore = false;

    const loadStars = async () => {
      const { data, error } = await supabase
        .from("stars")
        .select("id, x, y, z, is_claimed, color, message, owner_name")
        .order("id", { ascending: true })
        .limit(3000); // renderamo uzorak, ne svih 1M

      if (error) {
        console.error("Error loading stars:", error);
        return;
      }

      if (!ignore) {
        setStars(data || []);
        setGlobalOpacity(0); // ponovni fade-in nakon reload-a
      }
    };

    loadStars();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // fade-in animacija
  useFrame((_, delta) => {
    setGlobalOpacity((prev) => {
      if (prev >= 1) return prev;
      const next = Math.min(1, prev + delta * 0.7);
      return next;
    });
  });

  const hoveredStar = stars.find((s) => s.id === hoveredId) || null;

  return (
    <group>
      {stars.map((star) => {
        const pos = [
          star.x * SCALE,
          star.y * SCALE,
          star.z * SCALE,
        ];
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
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredId((current) =>
                  current === star.id ? null : current
                );
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

      {/* Tooltip na hover – radi i u glavnom i u fullscreenu */}
      {hoveredStar && (
        <Html
          position={[
            hoveredStar.x * SCALE,
            hoveredStar.y * SCALE + 0.35,
            hoveredStar.z * SCALE,
          ]}
          distanceFactor={12}
        >
          <div className="rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1 text-xs text-slate-100 shadow-lg shadow-black/70 whitespace-nowrap">
            {hoveredStar.is_claimed ? (
              <>
                <span className="font-medium">
                  {hoveredStar.owner_name || "Someone"}
                </span>
                {hoveredStar.message && (
                  <span className="ml-2 text-slate-300">
                    “{hoveredStar.message}”
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-200">
                Unclaimed star · click to claim
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default StarField;
