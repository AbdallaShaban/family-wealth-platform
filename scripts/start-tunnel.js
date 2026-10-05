import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";

const PORT = process.env.PORT || 3000;
const ARTIFACT_DIR = "C:\\Users\\abdal\\.gemini\\antigravity-ide\\brain\\5bd4cdcc-e17f-4f15-bc34-6a4e574b171d";
const QR_PATH = path.join(ARTIFACT_DIR, "pwa_mobile_qr.png");
const TUNNEL_INFO_FILE = path.resolve(process.cwd(), ".tunnel-info.json");

console.log(`[Cloudflare Tunnel] Initializing encrypted tunnel for http://localhost:${PORT}...`);

const isWin = process.platform === "win32";
const token = process.env.CLOUDFLARE_TUNNEL_TOKEN;

const args = token
  ? ["cloudflared", "tunnel", "run", "--token", token]
  : ["cloudflared", "tunnel", "--url", `http://localhost:${PORT}`];

console.log(`[Cloudflare Tunnel] Running: npx ${args.join(" ")}`);

const child = spawn("npx", args, {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

let tunnelUrlFound = false;

async function handleOutput(data) {
  const text = data.toString();
  process.stdout.write(text);

  if (!tunnelUrlFound) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      tunnelUrlFound = true;
      const tunnelUrl = match[0];
      console.log("\n========================================================");
      console.log(`🚀 [Cloudflare Tunnel Online] URL: ${tunnelUrl}`);
      console.log("========================================================\n");

      // Save to json file
      const info = {
        url: tunnelUrl,
        startedAt: new Date().toISOString(),
        port: PORT,
      };
      fs.writeFileSync(TUNNEL_INFO_FILE, JSON.stringify(info, null, 2), "utf-8");

      // Generate QR Code PNG
      try {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
        await QRCode.toFile(QR_PATH, tunnelUrl, {
          width: 480,
          margin: 2,
          color: {
            dark: "#059669", // Emerald color
            light: "#FFFFFF",
          },
        });
        console.log(`[QR Code] Saved QR Code image to: ${QR_PATH}`);

        // Generate small terminal string
        const terminalQr = await QRCode.toString(tunnelUrl, { type: "terminal", small: true });
        console.log(terminalQr);
      } catch (err) {
        console.error("[QR Code] Error generating QR code:", err);
      }
    }
  }
}

child.stdout.on("data", handleOutput);
child.stderr.on("data", handleOutput);

child.on("close", (code) => {
  console.log(`[Cloudflare Tunnel] Process closed with code ${code}. PM2 daemon will automatically restart.`);
  process.exit(code || 0);
});

child.on("error", (err) => {
  console.error("[Cloudflare Tunnel] Failed to start cloudflared process:", err);
  process.exit(1);
});
