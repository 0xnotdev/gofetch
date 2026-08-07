import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@browserbasehq/stagehand"],
};

export default nextConfig;
