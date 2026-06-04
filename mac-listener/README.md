# Mac Speaker — listener

Runs on the always-on Mac Pro. Holds one persistent connection to Supabase
Realtime and plays each incoming voice note out loud with `afplay`. No polling.

## Setup (on the Mac)

1. Install Node 18+ if you don't have it:
   ```bash
   brew install node
   ```
2. (Optional but recommended) install ffmpeg so notes recorded on Android /
   desktop Chrome (webm/opus) can play. iPhone notes work without it.
   ```bash
   brew install ffmpeg
   ```
3. Copy this `mac-listener` folder onto the Mac, then inside it:
   ```bash
   cp .env.example .env      # then edit .env with your Supabase URL + anon key
   npm install
   ```
4. Test it in the foreground first:
   ```bash
   npm start
   ```
   You should see `Listening for voice notes… 🔊`. Send a note from the website
   and it should play.

5. Once that works, install it as a background service that auto-starts on
   login and restarts on crash:
   ```bash
   ./install.sh
   ```

## Handy commands

```bash
tail -f listener.log                                          # watch logs
launchctl unload ~/Library/LaunchAgents/com.macspeaker.listener.plist  # stop
launchctl load   ~/Library/LaunchAgents/com.macspeaker.listener.plist  # start
```

## Notes
- Make sure the Mac's output volume is up and not muted.
- Notes play one at a time (queued), never overlapping.
- The `played` flag on each row is set after playback (best-effort).
