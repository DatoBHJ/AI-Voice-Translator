import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // ESLint 에러가 있어도 빌드가 진행되도록 설정
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
