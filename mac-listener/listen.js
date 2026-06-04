// Mac Speaker — listener
// Subscribes to Supabase Realtime. When a new voice note is inserted, downloads
// the audio and plays it out loud with macOS `afplay`. webm/opus notes (Android
// / desktop Chrome) are transcoded first with ffmpeg if available.
//
// Run with:  node listen.js     (after `npm install` and filling in .env)

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve ffmpeg: prefer a static binary dropped next to this script
// (./ffmpeg), then FFMPEG_PATH, then whatever is on PATH.
const here = dirname(fileURLToPath(import.meta.url));
const localFfmpeg = join(here, "ffmpeg");
const FFMPEG = process.env.FFMPEG_PATH
  ? process.env.FFMPEG_PATH
  : existsSync(localFfmpeg)
    ? localFfmpeg
    : "ffmpeg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing env. Set SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example).",
  );
  process.exit(1);
}

// Node < 22 has no global WebSocket, which Supabase Realtime needs. Supply the
// `ws` package as the transport so this runs on any Node version.
let realtimeTransport;
if (typeof WebSocket === "undefined") {
  realtimeTransport = (await import("ws")).default;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    transport: realtimeTransport,
    params: { eventsPerSecond: 5 },
  },
});

const log = (...args) =>
  console.log(new Date().toISOString(), ...args);

// --- playback queue (play notes one at a time, never overlapping) -----------
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch((err) => log("playback error:", err.message));
  return queue;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${cmd} exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`),
          ),
    );
  });
}

async function hasFfmpeg() {
  try {
    await run(FFMPEG, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function playFile(path, ext) {
  // afplay handles m4a/aac, mp3, wav, aiff, caf natively. For webm/opus we need
  // to transcode to wav first.
  if (ext !== "webm") {
    try {
      await run("afplay", [path]);
      return;
    } catch (err) {
      log("afplay failed:", err.message, "— trying ffmpeg fallback");
      // fall through to ffmpeg transcode (some m4a edge cases)
    }
  }
  if (await hasFfmpeg()) {
    const wav = `${path}.wav`;
    await run(FFMPEG, ["-y", "-i", path, wav]);
    await run("afplay", [wav]);
    await rm(wav, { force: true });
  } else {
    throw new Error(
      `Cannot play .${ext}: no working ffmpeg found (looked for ${FFMPEG}).`,
    );
  }
}

async function handleMessage(row) {
  const who = row.sender ? `from ${row.sender}` : "anonymous";
  log(`▶ new note ${who} (${row.audio_path})`);

  const res = await fetch(row.audio_url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const ext = (row.audio_path.split(".").pop() || "m4a").toLowerCase();
  const dir = await mkdtemp(join(tmpdir(), "macspeaker-"));
  const file = join(dir, `note.${ext}`);
  await writeFile(file, buf);

  try {
    await playFile(file, ext);
    log("✓ played");
    // best-effort: mark as played
    await supabase.from("messages").update({ played: true }).eq("id", row.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// --- subscribe --------------------------------------------------------------
const channel = supabase
  .channel("voice-notes")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => enqueue(() => handleMessage(payload.new)),
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      log("Listening for voice notes… 🔊");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      log("realtime status:", status, "(will auto-reconnect)");
    }
  });

process.on("SIGINT", async () => {
  log("shutting down");
  await supabase.removeChannel(channel);
  process.exit(0);
});
