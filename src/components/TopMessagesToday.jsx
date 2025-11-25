// src/components/TopMessagesToday.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TopMessagesToday = () => {
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from("stars")
          .select(
            "id, owner_name, message, claimed_at"
          )
          .eq("is_claimed", true)
          .not("message", "is", null)
          .gte("claimed_at", startOfDay.toISOString())
          .order("claimed_at", { ascending: false })
          .limit(6);

        if (error) {
          console.error("TopMessagesToday error:", error);
        } else {
          setStars(data || []);
        }
      } catch (e) {
        console.error("TopMessagesToday exception:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Loading today&apos;s brightest messages...
      </p>
    );
  }

  if (!stars.length) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        No stars claimed yet today. Be the first to leave a message in the
        universe.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 mt-6">
      {stars.map((s) => (
        <div
          key={s.id}
          className="p-4 border border-slate-800 rounded-2xl bg-slate-950"
        >
          <p className="text-[11px] text-slate-400 mb-1 font-mono">
            Star #{s.id}
          </p>
          <h3 className="text-sm font-medium">
            {s.owner_name || "Anonymous"}
          </h3>
          <p className="text-slate-300 text-sm mt-1">“{s.message}”</p>
          <p className="text-[11px] text-slate-500 mt-2">
            Today&apos;s universe highlight
          </p>
        </div>
      ))}
    </div>
  );
};

export default TopMessagesToday;
