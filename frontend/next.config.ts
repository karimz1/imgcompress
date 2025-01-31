/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable rewrites only when running in development mode
  async rewrites() {
    if (process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }
    // No rewrites in production (or you can adjust as needed)
    return [];
  },

  // Enable static export if desired in production
  // For example, if an environment variable OUTPUT_STATIC is set,
  // you can use that, or simply check NODE_ENV.
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
};

module.exports = nextConfig;
