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
      {
        source: '/api/access/:path*',
        destination: `${apiInternalUrl}/api/access/:path*`,
      },
      {
        source: '/api/settings/bot',
        destination: `${apiInternalUrl}/api/settings/bot`,
      },
      {
        source: '/api/settings/bot/:path*',
        destination: `${apiInternalUrl}/api/settings/bot/:path*`,
      },
    ];
  },
};

export default nextConfig;
