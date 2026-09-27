const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${apiInternalUrl}/api/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
