const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      { source: '/attendance/display', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      {
        source: '/api/attendance-display/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${apiInternalUrl}/api/auth/:path*`,
      },
      {
        source: '/api/attendance-display/:path*',
        destination: `${apiInternalUrl}/api/attendance-display/:path*`,
      },
      {
        source: '/api/seasons/:path*',
        destination: `${apiInternalUrl}/api/seasons/:path*`,
      },
      {
        source: '/api/roster/:path*',
        destination: `${apiInternalUrl}/api/roster/:path*`,
      },
    ];
  },
};

export default nextConfig;
