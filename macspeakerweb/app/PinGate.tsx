"use client";

import { useCallback, useEffect, useState } from "react";

// Soft gate: keeps casual strangers out. The PIN ships in the client bundle, so
// it is NOT real security — see README for hardening with server-side checks.
const PIN = process.env.NEXT_PUBLIC_PIN || "1234";
const LEN = PIN.length;

// iOS-style sub-labels under each digit.
const LETTERS: Record<string, string> = {
  "1": "",
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
  "0": "",
};

export default function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [entry, setEntry] = useState("");
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    (code: string) => {
      if (code === PIN) {
        try {
          sessionStorage.setItem("macspeaker_unlocked", "1");
        } catch {
          /* ignore */
        }
        onUnlock();
      } else {
        setShake(true);
        try {
          navigator.vibrate?.([12, 60, 12]);
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          setShake(false);
          setEntry("");
        }, 500);
      }
    },
    [onUnlock],
  );

  const press = useCallback(
    (d: string) => {
      setEntry((prev) => {
        if (prev.length >= LEN || shake) return prev;
        const next = prev + d;
        try {
          navigator.vibrate?.(8);
        } catch {
          /* ignore */
        }
        if (next.length === LEN) {
          // let the final dot paint before validating
          setTimeout(() => submit(next), 130);
        }
        return next;
      });
    },
    [submit, shake],
  );

  const del = useCallback(() => setEntry((p) => p.slice(0, -1)), []);

  // hardware keyboard support (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, del]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="flex flex-col items-center gap-12">
      <div className="flex flex-col items-center gap-7">
        <h1 className="text-xl font-medium text-black dark:text-zinc-50">
          Skriv inn kode
        </h1>
        <div className={`flex gap-5 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
          {Array.from({ length: LEN }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                i < entry.length
                  ? "border-black bg-black dark:border-white dark:bg-white"
                  : "border-zinc-400 dark:border-zinc-500"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-5">
        {keys.map((k, idx) => {
          if (k === "") return <span key={idx} />;
          if (k === "del") {
            return (
              <button
                key={idx}
                type="button"
                onClick={del}
                aria-label="Slett"
                className="flex h-[74px] w-[74px] items-center justify-center text-sm text-black active:opacity-40 dark:text-zinc-50"
              >
                {entry.length > 0 ? "Slett" : ""}
              </button>
            );
          }
          return (
            <button
              key={idx}
              type="button"
              onClick={() => press(k)}
              className="flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full bg-zinc-200/80 text-black transition active:bg-zinc-400/80 dark:bg-zinc-700/70 dark:text-white dark:active:bg-zinc-500/70"
            >
              <span className="text-3xl font-light leading-none">{k}</span>
              {LETTERS[k] && (
                <span className="mt-1 text-[10px] font-semibold tracking-[0.2em]">
                  {LETTERS[k]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
