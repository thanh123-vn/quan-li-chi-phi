/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // để fix 404 Cloudflare
  typescript: {
    ignoreBuildErrors: true,
  },
   eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
