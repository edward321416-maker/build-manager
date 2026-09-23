import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@build-manager/domain",
    "@build-manager/application",
    "@build-manager/api-contracts",
    "@build-manager/api-client",
    "@build-manager/fixtures",
    "@build-manager/persistence-postgres",
  ],
};

export default nextConfig;
