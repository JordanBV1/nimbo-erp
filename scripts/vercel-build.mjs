import { execSync } from "node:child_process";
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, ".vercel", "output");
const dist = path.join(root, "dist");

fs.rmSync(output, { recursive: true, force: true });
fs.rmSync(dist, { recursive: true, force: true });

execSync("npx vite build", { cwd: root, stdio: "inherit" });

fs.cpSync(dist, path.join(output, "static"), { recursive: true });

const vcConfig = JSON.stringify(
  { runtime: "nodejs20.x", handler: "index.cjs", launcherType: "Nodejs" },
  null,
  2,
);

const entries = [
  { src: "api/index.ts", func: path.join(output, "functions", "api", "index.func") },
  { src: "api/cron/backup.ts", func: path.join(output, "functions", "api", "cron", "backup.func") },
  { src: "api/cron/reminders.ts", func: path.join(output, "functions", "api", "cron", "reminders.func") },
];

for (const entry of entries) {
  fs.mkdirSync(entry.func, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, entry.src)],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node20"],
    outfile: path.join(entry.func, "index.cjs"),
    logLevel: "info",
  });
  fs.writeFileSync(path.join(entry.func, ".vc-config.json"), vcConfig);
}

fs.writeFileSync(path.join(output, "config.json"), JSON.stringify({}, null, 2));

console.log(`Build Output API generated at ${output}`);
