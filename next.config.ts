import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite is only used for the local demo and tests; never bundle it.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
};

export default nextConfig;
