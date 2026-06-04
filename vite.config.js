import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Ganti "openrouter-chat" dengan nama repo GitHub kamu
// Contoh: repo bernama "ai-chat" → base: "/ai-chat/"
export default defineConfig({
  plugins: [react()],
  base: "/OpenChat/",
});
