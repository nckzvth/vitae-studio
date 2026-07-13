import type { NextConfig } from "next";

const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages
  ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "/vitae-studio")
  : "";

const nextConfig: NextConfig = {
  output: isPages ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
