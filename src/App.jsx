// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

import StarField from "./components/StarField.jsx";
import MyStars from "./components/MyStars.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth.jsx";
import ClaimProgress from "./components/ClaimProgress.jsx";
import TopMessagesToday from "./components/TopMessagesToday.jsx";

const SCALE = 0.6;

/* 🌞 REALISTIČNI SUNČEV SUSTAV ------------------------------------ */

const PLANETS = [
  {
    name: "Mercury",
    distance: 7,
    size: 0.4,
    color: "#b1b1b1",
    orbitSpeed: 0.18,
    rotationSpeed: 0.35,
  },
  {
    name: "Venus",
    distance: 9,
    size: 0.7,
    color: "#d9b26f",
    orbitSpeed: 0.14,
    rotationSpeed: 0.3,
  },
  {
    name: "Earth",
    distance: 11,
    size: 0.75,
    color: "#4f9df7",
    orbitSpeed: 0.11,
    rotationSpeed: 0.4,
  },
  {
    name: "Mars",
    distance: 13,
    size: 0.6,
    color: "#d26b47",
    orbitSpeed: 0.09,
    rotationSpeed: 0.35,
  },
  {
    name: "Jupiter",
    distance: 17,
    size: 1.8,
    color: "#e0c29c",
    orbitSpeed: 0.05,
    rotationSpeed: 0.45,
  },
  {
    name: "Saturn",
    distance: 21,
    size: 1.5,
    color: "#e6d7a8",
    orbitSpeed: 0.042,
    rotationSpeed: 0.4,
    hasRings: true,
  },
  {
    name: "Uranus",
    distance: 25,
    size: 1.1,
    color: "#9bd7ff",
    orbitSpeed: 0.035,
    rotationSpeed: 0.4,
  },
  {
    name: "Neptune",
    distance: 29,
    size: 1.1,
    color: "#4976ff",
    orbitSpeed: 0.03,
    rotationSpeed: 0.4,
  },
];

function Planet({
  distance,
  size,
  color,
  orbitSpeed,
  rotationSpeed,
  hasRings,
  texture,
}) {
  const orbitRef = useRef();
  const planetRef = useRef();

  // 🔹 random početni kut za svaki planet
  const initialAngle = useRef(Math.random() * Math.PI * 2);

  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y = initialAngle.current;
    }
  }, []);

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
      {/* CORE */}
      <mesh
        ref={planetRef}
        position={[distance, 0, 0]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          map={texture || null}
          color={color}
          emissive="#020617"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* TINY GLOW / AURA */}
      <mesh position={[distance, 0, 0]}>
        <sphereGeometry args={[size * 1.4, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} />
      </mesh>

      {/* SATURN RINGS */}
      {hasRings && (
        <mesh position={[distance, 0, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[size * 1.4, size * 2.2, 64]} />
          <meshStandardMaterial
            color="#f5e6c8"
            emissive="#4b5563"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
const SolarSystem = () => {
  const planetTextures = useTexture({
    Mercury: "/textures/mercury.jpg",
    Venus: "/textures/venus.jpg",
    Earth: "/textures/earth.jpg",
    Mars: "/textures/mars.jpg",
    Jupiter: "/textures/jupiter.jpg",
    Saturn: "/textures/saturn.jpg",
    Uranus: "/textures/uranus.jpg",
    Neptune: "/textures/neptune.jpg",
  });

  const sunRef = useRef();

  useFrame((_, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.15 * delta;
    }
  });

  return (
    <>
      {/* SUNCE */}
      <mesh ref={sunRef} position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[3, 48, 48]} />
        <meshStandardMaterial
          emissive="#facc15"
          emissiveIntensity={1.8}
          color="#fde68a"
        />
      </mesh>

      {/* GLAVNO SVJETLO */}
      <pointLight
        position={[0, 0, 0]}
        intensity={3.5}
        distance={220}
        color="#facc15"
        castShadow
      />

      {/* AMBIJENT */}
      <ambientLight intensity={0.25} />

      {/* PLANETI */}
      {PLANETS.map((p) => (
        <Planet key={p.name} {...p} texture={planetTextures[p.name]} />
      ))}
    </>
  );
};

/* 🎥 CAMERA RIG – warp na odabranu zvijezdu ------------------------ */

const CameraRig = ({ selectedStar, controlsRef }) => {
  const { camera } = useThree();

  const defaultTarget = useRef(new THREE.Vector3(0, 0, 0));

  const modeRef = useRef("idle"); // "idle" | "out" | "in"
  const timerRef = useRef(0);
  const fromPosRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const midPosRef = useRef(new THREE.Vector3());
  const finalPosRef = useRef(new THREE.Vector3());
  const finalTargetRef = useRef(new THREE.Vector3());
  const tmpTargetRef = useRef(new THREE.Vector3());
  const lastStarIdRef = useRef(null);

  useEffect(() => {
    if (!selectedStar) {
      modeRef.current = "idle";
      lastStarIdRef.current = null;
      return;
    }

    if (lastStarIdRef.current === selectedStar.id) return;
    lastStarIdRef.current = selectedStar.id;

  const starPos = new THREE.Vector3(
  selectedStar.x * SCALE,
  selectedStar.y * SCALE,
  selectedStar.z * SCALE
);
const dir = starPos.clone().normalize();

// ciljat točno u zvijezdu
finalTargetRef.current.copy(starPos);

// 🔥 BUDI PUNO BLIŽE – 0.8–1.2 jedinica od zvijezde
const distanceFromStar = 1.0; // možeš kasnije smanjit na 0.7 ako želiš još bliže
finalPosRef.current.copy(starPos).add(dir.clone().multiplyScalar(distanceFromStar));

    fromPosRef.current.copy(camera.position);
    if (controlsRef.current) {
      fromTargetRef.current.copy(controlsRef.current.target);
    } else {
      fromTargetRef.current.copy(defaultTarget.current);
    }

    const outDir = fromPosRef.current
      .clone()
      .sub(finalPosRef.current)
      .normalize();
    midPosRef.current
      .copy(fromPosRef.current)
      .add(outDir.multiplyScalar(6));

    modeRef.current = "out";
    timerRef.current = 0;
  }, [selectedStar, camera, controlsRef]);

  useFrame((_, delta) => {
    const outDuration = 0.35;
    const inDuration = 0.55;

    if (modeRef.current === "out") {
      timerRef.current += delta;
      const t = Math.min(1, timerRef.current / outDuration);

      camera.position.lerpVectors(fromPosRef.current, midPosRef.current, t);
      tmpTargetRef.current.lerpVectors(
        fromTargetRef.current,
        finalTargetRef.current,
        t * 0.5
      );
      camera.lookAt(tmpTargetRef.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(tmpTargetRef.current);
        controlsRef.current.update();
      }

      if (t >= 1) {
        modeRef.current = "in";
        timerRef.current = 0;
      }
      return;
    }

    if (modeRef.current === "in") {
      timerRef.current += delta;
      const t = Math.min(1, timerRef.current / inDuration);

      camera.position.lerpVectors(midPosRef.current, finalPosRef.current, t);
      tmpTargetRef.current.lerpVectors(
        fromTargetRef.current,
        finalTargetRef.current,
        t
      );
      camera.lookAt(tmpTargetRef.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(tmpTargetRef.current);
        controlsRef.current.update();
      }

      if (t >= 1) {
        modeRef.current = "idle";
      }
      return;
    }

    if (!selectedStar) return;
  });

  return null;
};

/* 🔭 GLAVNI APP ---------------------------------------------------- */

const App = () => {
  const { user } = useAuth();

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [selectedStar, setSelectedStar] = useState(null);
  const [hoveredStar, setHoveredStar] = useState(null);

  const [form, setForm] = useState({
    name: "",
    message: "",
    color: "cyan",
  });

  const [reloadKey, setReloadKey] = useState(0);
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");

  const [textQuery, setTextQuery] = useState("");
  const [textSearchError, setTextSearchError] = useState("");

  const [isUniverseFullscreen, setIsUniverseFullscreen] = useState(false);

  const [claimStep, setClaimStep] = useState("form"); // "form" | "success"
  const [recentlyClaimedStar, setRecentlyClaimedStar] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [allStars, setAllStars] = useState([]); // sve učitane zvijezde

  const controlsRef = useRef(null);

  useEffect(() => {
    const testSupabase = async () => {
      const { count, error } = await supabase
        .from("stars")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error("Supabase test error:", error);
      } else {
        console.log("Supabase connected! Stars in DB:", count);
      }
    };

    testSupabase();
  }, []);

  const handleOpenClaimModal = (e) => {
    if (e) e.preventDefault();
    setIsClaimModalOpen(true);
    setClaimStep("form");
    setShareCopied(false);
  };

  const handleStarClick = (star) => {
    console.log("Clicked star:", star);
    setSelectedStar(star);
    setIsClaimModalOpen(false);
  };

  const handleStarHover = (star) => {
    setHoveredStar(star);
  };

  const handleStarsLoaded = (stars) => {
    setAllStars(stars || []);
  };

  const handlePickRandomFreeStar = () => {
    if (!allStars || allStars.length === 0) {
      alert("The universe is still loading. Try again in a moment.");
      return;
    }

    const freeStars = allStars.filter((s) => !s.is_claimed);
    if (freeStars.length === 0) {
      alert("All stars have been claimed.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * freeStars.length);
    const randomStar = freeStars[randomIndex];

    setSelectedStar(randomStar);
    setIsClaimModalOpen(true);
    setClaimStep("form");
    setShareCopied(false);

    const el = document.getElementById("universe");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleJumpToStar = (star) => {
    setSelectedStar(star);
    setIsClaimModalOpen(false);
    const el = document.getElementById("universe");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCloseClaimModal = () => {
    setIsClaimModalOpen(false);
    setForm({
      name: "",
      message: "",
      color: "cyan",
    });
    setClaimStep("form");
    setShareCopied(false);
    setRecentlyClaimedStar(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorSelect = (color) => {
    setForm((prev) => ({ ...prev, color }));
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();

    if (!selectedStar) {
      alert(
        "First click on a free star in the universe to choose which one you want to claim."
      );
      return;
    }

    if (!user) {
      alert("You need to log in with Google before claiming a star.");
      setAuthOpen(true);
      return;
    }

    const payload = {
      is_claimed: true,
      color: form.color,
      message: form.message || null,
      owner_name: form.name || "Anonymous",
      owner_uid: user.id,
    };

    console.log("Claiming star:", selectedStar.id, payload);

    const { error } = await supabase
      .from("stars")
      .update(payload)
      .eq("id", selectedStar.id)
      .eq("is_claimed", false);

    if (error) {
      console.error("Error claiming star:", error);
      alert(
        "Something went wrong while claiming this star. Check the console for details."
      );
      return;
    }

    setReloadKey((k) => k + 1);
    setRecentlyClaimedStar(selectedStar);
    setClaimStep("success");
  };

  const handleViewClaimedInUniverse = () => {
    const star = recentlyClaimedStar || selectedStar;
    if (!star) return;
    setSelectedStar(star);
    setIsClaimModalOpen(false);
    const el = document.getElementById("universe");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCopyShareLink = () => {
    const star = recentlyClaimedStar || selectedStar;
    if (!star) return;

    const url = `${window.location.origin}/star/${star.id}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => setShareCopied(true))
        .catch(() => setShareCopied(false));
    } else {
      window.prompt("Copy this link:", url);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setSearchError("");

    const trimmed = searchId.trim();
    if (!trimmed) return;

    const idNum = Number(trimmed);
    if (Number.isNaN(idNum)) {
      setSearchError("Please enter a valid numeric ID.");
      return;
    }

    const { data, error } = await supabase
      .from("stars")
      .select("id, x, y, z, is_claimed, color, owner_name, message, owner_uid")
      .eq("id", idNum)
      .maybeSingle();

    if (error) {
      console.error("Search error:", error);
      setSearchError("Something went wrong. Try again.");
      return;
    }

    if (!data) {
      setSearchError("No star found with that ID.");
      return;
    }

    setSelectedStar(data);
    setIsClaimModalOpen(false);
    setSearchError("");

    const el = document.getElementById("universe");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleTextSearchSubmit = async (e) => {
    e.preventDefault();
    setTextSearchError("");

    const q = textQuery.trim();
    if (!q) return;

    const { data, error } = await supabase
      .from("stars")
      .select("id, x, y, z, is_claimed, color, owner_name, message, owner_uid")
      .or(`message.ilike.%${q}%,owner_name.ilike.%${q}%`)
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Text search error:", error);
      setTextSearchError("Something went wrong. Try again.");
      return;
    }

    if (!data || data.length === 0) {
      setTextSearchError("No stars found for that search.");
      return;
    }

    const star = data[0];
    setSelectedStar(star);
    setIsClaimModalOpen(false);
    setTextSearchError("");

    const el = document.getElementById("universe");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const sidebarStar = hoveredStar || selectedStar;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAVBAR */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">
              ⭐
            </span>
            <span className="text-lg font-semibold tracking-tight">
              StarBazaar
            </span>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#universe" className="hover:text-white">
              Explore the universe
            </a>
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
            <a href="#mystars" className="hover:text-white">
              My stars
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-xs text-slate-400 md:inline">
                {user.email}
              </span>
            )}

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-slate-800 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700"
              >
                Log out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        {/* HERO */}
        <section className="flex flex-col items-center gap-10 py-8 md:flex-row md:py-16">
          {/* LEFT */}
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
              <span className="text-base">✨</span>
              1,000,000 digital stars · $1 each
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold">
              Buy a{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent">
                single star
              </span>{" "}
              in our universe for $1
            </h1>

            <p className="max-w-xl text-slate-300 text-sm md:text-base">
              We&apos;re selling exactly 1,000,000 digital stars. Each costs
              $1, comes with your message, and is forever visible in this
              universe once claimed.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleOpenClaimModal}
                className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Buy a star for $1
              </button>
              <button
                type="button"
                onClick={handlePickRandomFreeStar}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs md:text-sm text-slate-100 hover:border-indigo-400 hover:text-white"
              >
                Pick a random free star
              </button>
              <a
                href="#universe"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm"
              >
                View the universe
              </a>
            </div>
          </div>

          {/* RIGHT – Universe progress */}
          <div className="flex-1">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-slate-300">
                  
                </h3>
                <span className="text-[11px] text-slate-400">
                  Goal: 1,000,000 stars sold
                </span>
              </div>

              <ClaimProgress />

              <div className="h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-sky-400 to-fuchsia-400 opacity-70 animate-pulse" />
              </div>

              <p className="text-[11px] text-slate-500">
                Every claimed star permanently lights up this digital galaxy.
              </p>
            </div>
          </div>
        </section>

        {/* UNIVERSE SECTION */}
        <section
          id="universe"
          className="mt-16 grid gap-8 md:grid-cols-[2fr_1fr]"
        >
          {/* LEFT – 3D UNIVERSE */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 text-xs text-slate-400 flex justify-between items-center">
              <span>Interactive universe</span>
              <div className="flex items-center gap-2">
                {selectedStar && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Centered on star #{selectedStar.id}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsUniverseFullscreen(true)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200 hover:border-indigo-400 hover:text-white"
                >
                  Fullscreen
                </button>
              </div>
            </div>

            <div className="relative h-80 rounded-2xl border border-slate-800 overflow-hidden bg-black">
              <Canvas camera={{ position: [0, 40, 90], fov: 60 }}>
                <color attach="background" args={["#020617"]} />
                <Stars
                  radius={200}
                  depth={80}
                  count={9000}
                  factor={4}
                  saturation={0}
                  fade
                  speed={0.4}
                />

                <SolarSystem />
                <StarField
                  onStarClick={handleStarClick}
                  onStarHover={handleStarHover}
                  onStarsLoaded={handleStarsLoaded}
                  reloadKey={reloadKey}
                />

            <OrbitControls
  ref={controlsRef}
  enablePan
  enableDamping
  enableZoom
  dampingFactor={0.08}
  minDistance={0.3}   // 🔥 puno bliže
  maxDistance={220}
/>
                <CameraRig
                  selectedStar={selectedStar}
                  controlsRef={controlsRef}
                />
              </Canvas>

              <div className="absolute top-3 left-3 text-[11px] bg-black/60 px-3 py-1 rounded-full">
                Drag to rotate · Scroll / pinch to zoom · Right-click /
                two-finger drag to pan · Tap a star to select
              </div>

              {hoveredStar && hoveredStar.is_claimed && (
                <div className="absolute bottom-3 left-3 max-w-xs rounded-2xl border border-slate-700 bg-black/70 px-3 py-2 text-[11px] text-slate-100 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">
                      Star #{hoveredStar.id}
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      Claimed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-3">
                    “{hoveredStar.message || "No message"}”
                  </p>
                  <p className="text-[10px] text-slate-400">
                    by {hoveredStar.owner_name || "Anonymous"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT – SIDEBAR */}
          <aside className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 space-y-5">
            {sidebarStar ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs space-y-1">
                <p className="font-mono text-slate-200">
                  Star #{sidebarStar.id}
                </p>
                {sidebarStar.is_claimed ? (
                  <>
                    <p className="text-[11px] text-slate-400">
                      Claimed by{" "}
                      <span className="text-slate-200">
                        {sidebarStar.owner_name || "Anonymous"}
                      </span>
                    </p>
                    {sidebarStar.message && (
                      <p className="text-[11px] text-slate-300 line-clamp-3">
                        “{sidebarStar.message}”
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-emerald-400 font-medium">
                      Not claimed yet
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenClaimModal}
                      className="mt-1 rounded-full bg-indigo-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-400"
                    >
                      Claim this star for $1
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-400">
                Hover a star to preview it. Click a free star to select it, then
                claim it for $1.
              </div>
            )}

            <h2 className="text-lg font-semibold">Explore the galaxy</h2>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>✦ Zoom and rotate the 3D starfield.</li>
              <li>✦ Hover to preview people&apos;s messages.</li>
              <li>✦ Click a free star to select it.</li>
              <li>✦ Use “Claim this star” to make it yours for $1.</li>
            </ul>

            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Jump to a star by ID
              </p>
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="number"
                  min="1"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter star ID..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
                >
                  Go
                </button>
              </form>
              {searchError && (
                <p className="text-[11px] text-rose-400">{searchError}</p>
              )}
            </div>

            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Search by name or message
              </p>
              <form
                onSubmit={handleTextSearchSubmit}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  placeholder='e.g. "mom", "Mia", "thank you"...'
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
                >
                  Search
                </button>
              </form>
              {textSearchError && (
                <p className="text-[11px] text-rose-400">{textSearchError}</p>
              )}
            </div>
          </aside>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="mt-16">
          <h2 className="text-3xl font-semibold text-center">How it works</h2>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950">
              Pick a free star in the universe.
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950">
              Add your name, message and color.
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950">
              Pay $1. It&apos;s yours, forever.
            </div>
          </div>
        </section>

        {/* TOP MESSAGES TODAY */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Top messages today</h2>
          <TopMessagesToday />
        </section>

        {/* PRICING */}
        <section id="pricing" className="mt-16">
          <h2 className="text-3xl font-semibold text-center">Pricing</h2>

          <div className="mt-10 max-w-md mx-auto">
            <div className="p-6 border border-indigo-500 rounded-2xl bg-slate-950 text-center space-y-3">
              <h3 className="text-lg font-semibold">Single Star – $1</h3>
              <p className="text-sm text-slate-400">
                One unique star in this universe, with your name and message on
                it. No bundles, no tiers, just 1 star = $1.
              </p>
              <button
                onClick={handleOpenClaimModal}
                className="mt-2 w-full bg-indigo-500 px-4 py-2 rounded-full text-sm font-medium text-white hover:bg-indigo-400"
              >
                Buy a star for $1
              </button>
              <p className="text-[11px] text-slate-500">
                Once all 1,000,000 stars are claimed, no new ones are created.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold text-center">FAQ</h2>

          <details className="mt-4 p-4 border border-slate-800 rounded-lg bg-slate-950">
            <summary className="cursor-pointer text-white text-sm">
              What am I buying?
            </summary>
            <p className="text-slate-300 text-sm mt-2">
              You&apos;re buying a digital star in this universe: a unique
              position plus your chosen message and color. It&apos;s not an
              official astronomical registration.
            </p>
          </details>

          <details className="mt-4 p-4 border border-slate-800 rounded-lg bg-slate-950">
            <summary className="cursor-pointer text-white text-sm">
              How many stars exist?
            </summary>
            <p className="text-slate-300 text-sm mt-2">
              Exactly 1,000,000 stars. Once they&apos;re all claimed, no new
              stars are added.
            </p>
          </details>

          <details className="mt-4 p-4 border border-slate-800 rounded-lg bg-slate-950">
            <summary className="cursor-pointer text-white text-sm">
              Can I edit the message later?
            </summary>
            <p className="text-slate-300 text-sm mt-2">
              Not yet, but we may add editing in the future. For now, choose
              your words carefully.
            </p>
          </details>
        </section>

        <MyStars onJumpToStar={handleJumpToStar} />
      </main>

      {/* CLAIM MODAL */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6">
            {claimStep === "form" ? (
              <>
                <h2 className="text-lg font-semibold mb-2">
                  Claim your star for $1
                </h2>

                {selectedStar ? (
                  <p className="mb-3 text-xs text-slate-400">
                    You&apos;re claiming star with ID:{" "}
                    <span className="text-slate-100 font-mono">
                      #{selectedStar.id}
                    </span>
                  </p>
                ) : (
                  <p className="mb-3 text-xs text-amber-400">
                    First pick a free star in the universe, or use “Pick a
                    random free star”.
                  </p>
                )}

                <form
                  onSubmit={handleClaimSubmit}
                  className="space-y-4 text-sm"
                >
                  <div>
                    <label>Your name</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label>Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleInputChange}
                      maxLength={200}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {form.message.length}/200 characters
                    </p>
                  </div>

                  <div>
                    <label>Star color</label>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {["cyan", "indigo", "fuchsia", "amber", "emerald"].map(
                        (c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleColorSelect(c)}
                            className={`px-3 py-1.5 rounded-full text-xs border inline-flex items-center gap-1 ${
                              form.color === c
                                ? "border-indigo-500"
                                : "border-slate-700"
                            }`}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  c === "cyan"
                                    ? "#22d3ee"
                                    : c === "indigo"
                                    ? "#6366f1"
                                    : c === "fuchsia"
                                    ? "#e879f9"
                                    : c === "amber"
                                    ? "#fbbf24"
                                    : "#34d399",
                              }}
                            />
                            {c}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <button className="w-full bg-indigo-500 py-2 rounded-full">
                    Pay $1 & claim star
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2">
                  Star claimed successfully ✨
                </h2>
                {recentlyClaimedStar && (
                  <p className="mb-3 text-xs text-slate-400">
                    Star{" "}
                    <span className="font-mono text-slate-100">
                      #{recentlyClaimedStar.id}
                    </span>{" "}
                    is now yours in this universe.
                  </p>
                )}

                <div className="space-y-3 text-sm">
                  <button
                    type="button"
                    onClick={handleViewClaimedInUniverse}
                    className="w-full rounded-full bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                  >
                    View in universe
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="w-full rounded-full bg-slate-900 border border-slate-700 py-2 text-sm text-slate-100 hover:border-indigo-500"
                  >
                    Copy share link
                  </button>

                  {shareCopied && (
                    <p className="text-[11px] text-emerald-400">
                      Link copied to clipboard.
                    </p>
                  )}
                </div>
              </>
            )}

            <button
              onClick={handleCloseClaimModal}
              className="mt-4 text-slate-400 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {authOpen && !user && <AuthModal onClose={() => setAuthOpen(false)} />}

      {isUniverseFullscreen && (
        <div className="fixed inset-0 z-40 bg-black">
          <div className="absolute inset-0">
            <Canvas camera={{ position: [0, 40, 90], fov: 60 }}>
              <color attach="background" args={["#020617"]} />
              <Stars
                radius={220}
                depth={90}
                count={10000}
                factor={4}
                saturation={0}
                fade
                speed={0.4}
              />

              <SolarSystem />
              <StarField
                onStarClick={handleStarClick}
                onStarHover={handleStarHover}
                onStarsLoaded={handleStarsLoaded}
                reloadKey={reloadKey}
              />
              
            <OrbitControls
  ref={controlsRef}
  enablePan
  enableDamping
  enableZoom
  dampingFactor={0.08}
  minDistance={0.3}
  maxDistance={260}
/>
              <CameraRig
                selectedStar={selectedStar}
                controlsRef={controlsRef}
              />
            </Canvas>
          </div>

          {hoveredStar && hoveredStar.is_claimed && (
            <div className="absolute bottom-4 left-4 max-w-xs rounded-2xl border border-slate-700 bg-black/70 px-3 py-2 text-[11px] text-slate-100 space-y-1 z-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  Star #{hoveredStar.id}
                </span>
                <span className="text-[10px] text-emerald-400">Claimed</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-3">
                “{hoveredStar.message || "No message"}”
              </p>
              <p className="text-[10px] text-slate-400">
                by {hoveredStar.owner_name || "Anonymous"}
              </p>
            </div>
          )}

          <div className="absolute top-3 left-4 z-50 flex items-center gap-2 text-[11px] text-slate-300 bg-black/60 px-3 py-1 rounded-full">
            <span>
              Fullscreen universe · Drag to rotate · Scroll / pinch to zoom ·
              Right-click / two-finger drag to pan · Tap a star to select
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsUniverseFullscreen(false)}
            className="absolute top-3 right-4 z-50 rounded-full bg-black/70 border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            ✕ Exit fullscreen
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
