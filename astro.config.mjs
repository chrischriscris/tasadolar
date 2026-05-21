// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  image: {
    domains: ["flagcdn.com", "public.bnbstatic.com"],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
