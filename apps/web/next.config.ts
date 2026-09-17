import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@splitbill/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          { key: "Feature-Policy", value: "camera 'self'; microphone 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
