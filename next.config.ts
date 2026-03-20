import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // tắt eslint khi build
     typescript: { ignoreBuildErrors: true }, // add dòng này
  },
};

module.exports = nextConfig;
