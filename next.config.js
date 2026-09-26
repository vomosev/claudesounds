/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'https://claudesounds-api.arx-app.com:4107',
  },
};

module.exports = nextConfig;
