"use client";

import { useCallback, useRef, useState } from "react";
import { supabase, BUCKET } from "@/lib/supabaseClient";

type Status =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "uploading" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

// Prefer a format that macOS `afplay` can play natively (mp4/AAC, used by iOS
// Safari). Falls back to webm/opus on Android/desktop Chrome — the Mac listener
// transcodes that with ffmpeg.
function pickMimeType(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/mp4", ext: "m4a" },
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  // Last resort: let the browser decide.
  return { mimeType: "", ext: "webm" };
}

export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [sender, setSender] = useState("");
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const extRef = useRef<string>("webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const upload = useCallback(
    async (blob: Blob, ext: string) => {
      setStatus({ kind: "uploading" });
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `${stamp}-${rand}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, {
            contentType: blob.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const { error: insertError } = await supabase.from("messages").insert({
          sender: sender.trim() || null,
          audio_path: path,
          audio_url: pub.publicUrl,
        });
        if (insertError) throw insertError;

        setStatus({ kind: "sent" });
        setTimeout(() => setStatus({ kind: "idle" }), 3000);
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [sender],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType, ext } = pickMimeType();
      extRef.current = ext;

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        void upload(blob, extRef.current);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setSeconds(0);
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus({ kind: "recording" });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      let message = "Could not access the microphone.";
      if (name === "NotAllowedError" || name === "SecurityError") {
        message =
          "Mic blocked. Enable Microphone for your browser in your phone’s Settings, allow it for this site, then reload.";
      } else if (name === "NotFoundError") {
        message = "No microphone found on this device.";
      } else if (name === "NotReadableError") {
        message = "The mic is busy in another app. Close it and try again.";
      }
      setStatus({ kind: "error", message });
    }
  }, [upload]);

  const stopRecording = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const isRecording = status.kind === "recording";
  const isBusy = status.kind === "uploading";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            🔊 Mac Speaker
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Record a voice note — it plays out loud on the Mac.
          </p>
        </div>

        <input
          type="text"
          inputMode="text"
          placeholder="Your name (optional)"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          disabled={isRecording || isBusy}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isBusy}
          className={`flex h-40 w-40 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60 ${
            isRecording
              ? "animate-pulse bg-red-600 hover:bg-red-700"
              : "bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          }`}
        >
          {isRecording ? `Stop · ${seconds}s` : isBusy ? "Sending…" : "Record"}
        </button>

        <div className="h-6 text-center text-sm">
          {status.kind === "recording" && (
            <span className="text-red-600">● Recording… tap to send</span>
          )}
          {status.kind === "uploading" && (
            <span className="text-zinc-500">Uploading…</span>
          )}
          {status.kind === "sent" && (
            <span className="text-green-600">✓ Sent! Playing on the Mac.</span>
          )}
          {status.kind === "error" && (
            <span className="text-red-600">⚠ {status.message}</span>
          )}
        </div>
      </main>
    </div>
  );
}
