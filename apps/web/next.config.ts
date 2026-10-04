import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:"/core/join",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}]}];},
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
