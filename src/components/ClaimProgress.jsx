// src/components/ClaimProgress.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ClaimProgress = () => {
  const [stats, setStats] = useState({
    total: 0,
    claimed: 0,
    loading: true,
  });

  // helper za čitanje stanja iz baze
  const fetchStats = async () => {
    // ukupno zvijezda
    const { count: total, error: totalError } = await supabase
      .from("stars")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Error fetching total stars:", totalError);
      return;
    }

    // claimane zvijezde
    const { count: claimed, error: claimedError } = await supabase
      .from("stars")
      .select("*", { count: "exact", head: true })
      .eq("is_claimed", true);

    if (claimedError) {
      console.error("Error fetching claimed stars:", claimedError);
      return;
    }

    setStats({ total: total ?? 0, claimed: claimed ?? 0, loading: false });
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!isMounted) return;
      await fetchStats();
    };

    init();

    // Realtime kanal – kad se neka zvijezda update-a na claimed, refetch
    const channel = supabase
      .channel("stars-claim-progress")
      .on(
        "postgres_changes",
        {
          event: "update",
          schema: "public",
          table: "stars",
        },
        (payload) => {
          // ako nova vrijednost ima is_claimed = true → refetch
          if (payload.new?.is_claimed) {
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const { total, claimed, loading } = stats;
  const percentage =
    !total || loading ? 0 : Math.min(100, (claimed / total) * 100);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 shadow-md shadow-slate-950/60">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-medium text-slate-100">
          {loading ? "Loading universe…" : "Universe progress"}
        </span>
        {!loading && (
          <span className="tabular-nums text-[11px] text-slate-400">
            {claimed.toLocaleString()} / {total.toLocaleString()} stars claimed
          </span>
        )}
      </div>

      {/* progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {!loading && (
        <p className="mt-1 text-[11px] text-slate-400">
          {percentage < 5
            ? "You’re among the very first explorers."
            : percentage < 40
            ? "The galaxy is slowly filling with stories."
            : percentage < 80
            ? "Most of the universe is already claimed."
            : "Last pockets of free space left in the sky."}
        </p>
      )}
    </div>
  );
};

export default ClaimProgress;
