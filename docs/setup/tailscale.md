# Tailscale Setup

This app supports private local testing. Tailscale is the preferred remote access path. A temporary Cloudflare Quick Tunnel can be used for short tests through `tools/mac-control/一键开启公网连接.command`, but it should be closed after testing.

## Devices

1. Install Tailscale on the Mac.
2. Install Tailscale on the OPPO phone.
3. Log in to the same Tailscale account on both devices.
4. Keep the Mac awake while training if the phone needs live sync.

## Run The Local Services

From the project directory:

```bash
npm install
npm run dev:server
npm run dev:web
```

The default local ports are:

```text
API server: http://localhost:8787
Web app:    http://localhost:5173
```

## Open From The Phone

1. Find the Mac's Tailscale IP in the Tailscale app.
2. On the OPPO phone, open:

```text
http://<mac-tailscale-ip>:5173
```

3. Set up the local account the first time.

## Notes

- The Mac stores SQLite data under `data/`.
- Posture photos are stored under `uploads/`.
- `data/*.sqlite` and `uploads/*` are ignored by git.
- If the Mac sleeps or Tailscale disconnects, the PWA can still show the cached app shell and the last cached today plan.
