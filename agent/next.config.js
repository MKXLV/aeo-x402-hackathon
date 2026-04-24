/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow longer serverless function duration locally for the full pipeline
    serverComponentsExternalPackages: ["cheerio"],
  },
};

module.exports = nextConfig;
