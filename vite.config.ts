import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

/** Load CLERK_PUBLISHABLE_KEY from .dev.vars / .env so the SPA gets the same pk as the Worker. */
function clerkPublishableFromDisk(): string {
  for (const file of [".dev.vars", ".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key === "VITE_CLERK_PUBLISHABLE_KEY" || key === "CLERK_PUBLISHABLE_KEY") {
        return value;
      }
    }
  }
  return process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "";
}

const clerkPk = clerkPublishableFromDisk();

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  define: {
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPk),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
