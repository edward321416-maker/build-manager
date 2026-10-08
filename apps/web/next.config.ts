import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [
    {source:"/core/join",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}]},
    // Standalone Vendor page: the raw capability lives only in the URL fragment of this response.
    {source:"/vendor/job",headers:[{key:"Cache-Control",value:"no-store"},{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Content-Security-Policy",value:"frame-ancestors 'none'"}]},
  ];},
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
