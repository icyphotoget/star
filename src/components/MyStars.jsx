// src/components/MyStars.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const MyStars = ({ onJumpToStar }) => {
  const { user } = useAuth();
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("stars")
        .select("id, color, message, is_claimed, x, y, z")
        .eq("owner_uid", user.id)
        .order("id", { ascending: true });

      if (error) {
        console.error("Error loading user stars:", error);
      } else {
        setStars(data || []);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  if (!user) {
    return (
      <section id="mystars" className="mt-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-2">Your stars</h2>
        <p className="text-sm text-slate-300">
          Log in with Google to see stars you&apos;ve claimed.
        </p>
      </section>
    );
  }

  return (
    <section id="mystars" className="mt-16 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold text-white">Your stars</h2>
        {loading && (
          <span className="text-xs text-slate-400">Loading your stars...</span>
        )}
      </div>

      {stars.length === 0 && !loading && (
        <p className="text-sm text-slate-300">
          You haven&apos;t claimed any stars yet. Click on a free star in the
          galaxy to claim your first one.
        </p>
      )}

      {stars.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {stars.map((star) => (
            <article
              key={star.id}
              onClick={() => onJumpToStar && onJumpToStar(star)}
              className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-md shadow-slate-950/70 transition-colors hover:border-indigo-400 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-slate-400">
                  ID #{star.id}
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                  style={{
                    backgroundColor:
                      star.color === "cyan"
                        ? "#22d3ee"
                        : star.color === "indigo"
                        ? "#6366f1"
                        : star.color === "fuchsia"
                        ? "#e879f9"
                        : star.color === "amber"
                        ? "#fbbf24"
                        : star.color === "emerald"
                        ? "#34d399"
                        : "#facc15",
                  }}
                />
              </div>
              <p className="text-sm text-slate-200 mb-2">
                {star.message ? `“${star.message}”` : "(No message set)"}
              </p>
              <p className="text-[11px] text-slate-500">
                Position: x {star.x.toFixed(1)}, y {star.y.toFixed(1)}, z{" "}
                {star.z.toFixed(1)}
              </p>
              <p className="mt-2 text-[11px] text-indigo-300">
                Click to focus this star in the universe.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default MyStars;
