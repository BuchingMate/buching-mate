#!/usr/bin/env bun

import { spawn } from "child_process";

function run(command: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(" ")}${cwd ? ` (in ${cwd})` : ""}`);
    const proc = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

async function setup() {
  console.log("🚀 Setting up Buching...\n");

  // Step 1: Start database
  console.log("📦 Starting database...");
  await run("docker", ["compose", "up", "-d"]);

  // Step 2: Install dependencies
  console.log("\n📥 Installing dependencies...");
  await run("bun", ["install"]);

  // Step 3: Apply database migrations
  console.log("\n🗄️  Applying database migrations...");
  await run("bun", ["run", "db:migrate"], "apps/server");

  const serverPort = process.env.SERVER_PORT ?? "3456";
  const webPort = process.env.WEB_PORT ?? "5678";

  console.log("\n✅ Setup complete!");
  console.log("\nApplication ports:");
  console.log(`  Server: http://localhost:${serverPort}`);
  console.log(`  Web:    http://localhost:${webPort}`);
  console.log("\nNext steps:");
  console.log("  bun run dev     - Start development servers");
  console.log("  bun run db:logs - View database logs");
}

setup().catch((error) => {
  console.error("\n❌ Setup failed:", error.message);
  process.exit(1);
});
