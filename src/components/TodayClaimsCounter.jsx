// src/components/TodayClaimsCounter.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DAILY_GOAL = 500; // možeš promijeniti

function getTodayStartISO() {
  const d = new Date();
  // “danas” po tvojoj lokalnoj zoni – dovoljno dobro za sada
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const TodayClaimsCounter = () => {
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // inicijalni fetch
  useEffect(() => {
    const fetchToday = async () => {
      setLoading(true);
      const from = getTodayStartISO();

      const { count, error } = await supabase
        .from("stars")
        .select("*", { count: "exact", head: true })
        .eq("is_claimed", true)
        .gte("claimed_at", from);

      if (error) {
        console.error("Error fetching today's claims:", error);
      } else if (typeof count === "number") {
        setTodayCount(count);
      }
      setLoading(false);
    };

    fetchToday();
  }, []);

  // realtime subscribe – kad se zvijezda claim-a danas, broj skače +1
  useEffect(() => {
    const channel = supabase
      .channel("stars-claims-today")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "stars",
          filter: "is_claimed=eq.true",
        },
        (payload) => {
          const oldClaimed = payload.old?.is_claimed;
          const newClaimed = payload.new?.is_claimed;
          const claimedAt = payload.new?.claimed_at
            ? new Date(payload.new.claimed_at)
            : null;

          // reagiramo samo kad je zvijezda postala claimed (false -> true)
          if (!oldClaimed && newClaimed && claimedAt) {
            const todayStart = new Date(getTodayStartISO());
            if (claimedAt >= todayStart) {
              setTodayCount((c) => c + 1);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Realtime sub: stars-claims-today");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const progress = Math.min(100, (todayCount / DAILY_GOAL) * 100);

  return (
    <div className="w-full rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-5 shadow-lg shadow-slate-950/60">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Today’s star claims
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-50">
              {loading ? "…" : todayCount}
            </span>
            <span className="text-xs text-slate-400">
              / {DAILY_GOAL} goal
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg">⭐</span>
          <span className="text-[11px] text-emerald-400">
            live · auto-updates
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Progress to today&apos;s goal</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Each claim pins a tiny light into this universe. Help us reach today&apos;s
        milestone.
      </p>
    </div>
  );
};

export default TodayClaimsCounter;
