// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

import StarField from "./components/StarField.jsx";
import MyStars from "./components/MyStars.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth.jsx";

const recentStars = [
  { id: 1, name: "Marko K.", message: "For my mom, my real hero", time: "2 min ago" },
  { id: 2, name: "Ana S.", message: "For us two, always", time: "5 min ago" },
  { id: 3, name: "Galactic Anonymous", message: "I did it, mom!", time: "10 min ago" },
];

const SCALE = 0.6;

// 🎥 CameraRig – warp: zoom-out -> warp -> zoom-in na odabranu zvijezdu
const CameraRig = ({ selectedStar, controlsRef }) => {
  const { camera } = useThree();

  const defaultPos = useRef(new THREE.Vector3(0, 0, 12));
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

  // kad se promijeni selectedStar -> iniciraj warp
  React.useEffect(() => {
    if (!selectedStar) {
      modeRef.current = "idle";
      lastStarIdRef.current = null;
      return;
    }

    if (lastStarIdRef.current === selectedStar.id) {
      // već smo na toj zvijezdi
      return;
    }

    lastStarIdRef.current = selectedStar.id;

    const starPos = new THREE.Vector3(
      selectedStar.x * SCALE,
      selectedStar.y * SCALE,
      selectedStar.z * SCALE
    );
    const dir = starPos.clone().normalize();

    finalTargetRef.current.copy(starPos);
    finalPosRef.current.copy(starPos).add(dir.clone().multiplyScalar(4));

    fromPosRef.current.copy(camera.position);

    if (controlsRef.current) {
      fromTargetRef.current.copy(controlsRef.current.target);
    } else {
      fromTargetRef.current.copy(defaultTarget.current);
    }

    // warp “out” točka – malo dalje od trenutne pozicije, u smjeru suprotnom od cilja
    const outDir = fromPosRef.current
      .clone()
      .sub(finalPosRef.current)
      .normalize();

    midPosRef.current.copy(fromPosRef.current).add(outDir.multiplyScalar(6));

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

    // idle – nema odabrane zvijezde, lagano vraćaj kameru na default
    if (!selectedStar) {
      const step = 1 - Math.exp(-delta * 3);
      camera.position.lerp(defaultPos.current, step);
      camera.lookAt(defaultTarget.current);

      if (controlsRef.current) {
        controlsRef.current.target.lerp(defaultTarget.current, step);
        controlsRef.current.update();
      }
    }
  });

  return null;
};

const App = () => {
  const { user } = useAuth();

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [selectedStar, setSelectedStar] = useState(null);
  const [form, setForm] = useState({
    name: "",
    message: "",
    color: "cyan",
  });

  const [reloadKey, setReloadKey] = useState(0);
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");

  // global search po message / owner_name
  const [textQuery, setTextQuery] = useState("");
  const [textSearchError, setTextSearchError] = useState("");

  const [isUniverseFullscreen, setIsUniverseFullscreen] = useState(false);

  const controlsRef = useRef(null);

  // test Supabase konekcije
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
    setSelectedStar(null);
    setIsClaimModalOpen(true);
  };

  const handleStarClick = (star) => {
    console.log("Clicked star:", star);

    // claimed → samo warp & zoom
    if (star.is_claimed) {
      setSelectedStar(star);
      setIsClaimModalOpen(false);
      return;
    }

    // free → warp + claim modal
    setSelectedStar(star);
    setIsClaimModalOpen(true);
  };

  // klik na karticu u "My Stars"
  const handleJumpToStar = (star) => {
    setSelectedStar(star);
    setIsClaimModalOpen(false);
    const el = document.getElementById("universe");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleCloseClaimModal = () => {
    setIsClaimModalOpen(false);
    setForm({
      name: "",
      message: "",
      color: "cyan",
    });
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
      alert("First click on a free star in the universe to choose which one you want to claim.");
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
      alert("Something went wrong while claiming this star. Check the console for details.");
      return;
    }

    alert(`Star #${selectedStar.id} successfully claimed!`);

    setReloadKey((k) => k + 1);
    handleCloseClaimModal();
  };

  // search po ID-u
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
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // global search po ime / poruka
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
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAVBAR */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xl">
              ⭐
            </span>
            <span className="text-lg font-semibold tracking-tight">StarBazaar</span>
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
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
              <span className="text-base">✨</span>
              New kind of digital universe
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold">
              Own your{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent">
                personal star
              </span>{" "}
              for $1
            </h1>

            <p className="max-w-xl text-slate-300 text-sm md:text-base">
              Pick a star in our digital galaxy, choose its glow color and
              attach a message visible on hover. A tiny piece of the universe,
              with your words on it—forever.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenClaimModal}
                className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Buy a star
              </button>
              <a
                href="#universe"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-sm"
              >
                View the universe
              </a>
            </div>

            <p className="text-xs text-slate-400">0+ stars claimed – you're early.</p>
          </div>

          {/* HERO PREVIEW */}
          <div className="flex-1">
            <div className="relative mx-auto h-64 max-w-md rounded-3xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl">
              <div className="mb-3 text-xs text-slate-400 flex justify-between">
                <span>A small peek into our galaxy</span>
                <span className="inline-flex items-center gap-1 bg-slate-900 px-2 py-1 text-xs rounded-full">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Live preview
                </span>
              </div>

              <div className="relative h-[180px] rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-hidden">
                {[...Array(80)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-1 w-1 rounded-full bg-slate-100 opacity-70"
                    style={{
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                    }}
                  />
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Every dot can become someone's story.
              </p>
            </div>
          </div>
        </section>

        {/* UNIVERSE SECTION */}
        <section id="universe" className="mt-16 grid gap-8 md:grid-cols-[2fr_1fr]">
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
              <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
                <color attach="background" args={["#020617"]} />
                <Stars
                  radius={120}
                  depth={60}
                  count={6000}
                  factor={4}
                  saturation={0}
                  fade
                  speed={0.4}
                />
                <ambientLight intensity={0.4} />
                <StarField onStarClick={handleStarClick} reloadKey={reloadKey} />
                <OrbitControls
                  ref={controlsRef}
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.08}
                />
                <CameraRig selectedStar={selectedStar} controlsRef={controlsRef} />
              </Canvas>

              <div className="absolute top-3 left-3 text-[11px] bg-black/60 px-3 py-1 rounded-full">
                Drag to rotate · Scroll to zoom · Click a star
              </div>
            </div>
          </div>

          {/* RIGHT – SIDEBAR */}
          <aside className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 space-y-5">
            <h2 className="text-lg font-semibold">Explore the galaxy</h2>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>✦ Zoom and rotate the 3D starfield.</li>
              <li>✦ Hover to read people&apos;s messages.</li>
              <li>✦ Click a free star to claim it.</li>
              <li>✦ Click a claimed star to zoom to it.</li>
            </ul>

            {/* Search by ID */}
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

            {/* Search by text */}
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
              Pick a free star.
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950">
              Customize its glow & message.
            </div>
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950">
              Buy it for $1.
            </div>
          </div>
        </section>

        {/* LIVE FEED */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Latest stars</h2>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {recentStars.map((s) => (
              <div
                key={s.id}
                className="p-4 border border-slate-800 rounded-2xl bg-slate-950"
              >
                <h3 className="text-sm font-medium">{s.name}</h3>
                <p className="text-slate-300 text-sm mt-1">“{s.message}”</p>
                <p className="text-xs text-slate-400 mt-2">{s.time}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="mt-16">
          <h2 className="text-3xl font-semibold text-center">Pricing</h2>

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            <div className="p-6 border border-slate-800 rounded-2xl bg-slate-950">
              <h3 className="text-lg">Single Star – $1</h3>
              <button
                onClick={handleOpenClaimModal}
                className="mt-4 w-full bg-indigo-500 px-4 py-2 rounded-full"
              >
                Buy
              </button>
            </div>
            <div className="p-6 border border-indigo-500 rounded-2xl bg-slate-950">
              <h3 className="text-lg">5-Star Bundle – $4</h3>
              <button
                onClick={handleOpenClaimModal}
                className="mt-4 w-full bg-indigo-500 px-4 py-2 rounded-full"
              >
                Buy Bundle
              </button>
            </div>
            <div className="p-6 border border-slate-800 rounded-2xl bg-slate-950">
              <h3 className="text-lg">Sponsor – $100</h3>
              <button
                onClick={handleOpenClaimModal}
                className="mt-4 w-full bg-slate-800 px-4 py-2 rounded-full"
              >
                Become Sponsor
              </button>
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
            <p className="text-slate-300 text-sm mt-2">A digital star, not a real one.</p>
          </details>

          <details className="mt-4 p-4 border border-slate-800 rounded-lg bg-slate-950">
            <summary className="cursor-pointer text-white text-sm">
              Can I edit the message?
            </summary>
            <p className="text-slate-300 text-sm mt-2">Soon.</p>
          </details>
        </section>

        {/* MY STARS */}
        <MyStars onJumpToStar={handleJumpToStar} />
      </main>

      {/* CLAIM MODAL */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-2">Claim your star</h2>

            {selectedStar && (
              <p className="mb-3 text-xs text-slate-400">
                You&apos;re claiming star with ID:{" "}
                <span className="text-slate-100 font-mono">{selectedStar.id}</span>
              </p>
            )}

            <form onSubmit={handleClaimSubmit} className="space-y-4 text-sm">
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
                  className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label>Star color</label>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {["cyan", "indigo", "fuchsia", "amber", "emerald"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleColorSelect(c)}
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        form.color === c ? "border-indigo-500" : "border-slate-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button className="w-full bg-indigo-500 py-2 rounded-full">
                Claim star
              </button>
            </form>

            <button
              onClick={handleCloseClaimModal}
              className="mt-4 text-slate-400 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* GOOGLE AUTH MODAL */}
      {authOpen && !user && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* FULLSCREEN UNIVERSE OVERLAY */}
      {isUniverseFullscreen && (
        <div className="fixed inset-0 z-40 bg-black">
          {/* Canvas u pozadini */}
          <div className="absolute inset-0">
            <Canvas camera={{ position: [0, 0, 14], fov: 60 }}>
              <color attach="background" args={["#020617"]} />
              <Stars
                radius={160}
                depth={80}
                count={8000}
                factor={4}
                saturation={0}
                fade
                speed={0.4}
              />
              <ambientLight intensity={0.4} />
              <StarField onStarClick={handleStarClick} reloadKey={reloadKey} />
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
              />
              <CameraRig selectedStar={selectedStar} controlsRef={controlsRef} />
            </Canvas>
          </div>

          {/* Info tekst gore lijevo */}
          <div className="absolute top-3 left-4 z-50 flex items-center gap-2 text-[11px] text-slate-300 bg-black/60 px-3 py-1 rounded-full">
            <span>
              Fullscreen universe · Drag to rotate · Scroll to zoom · Click a star
            </span>
          </div>

          {/* X gumb gore desno */}
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
