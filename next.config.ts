import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PixiJS ships modern ESM; let Next transpile it for the app bundle.
  transpilePackages: ["pixi.js"],
};

export default nextConfig;
