/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Log for debugging (this output will appear during build time)
    console.log('IS_RUNNING_IN_DEVCONTAINER:', process.env.IS_RUNNING_IN_DEVCONTAINER, 'NODE_ENV:', process.env.NODE_ENV);

    if (process.env.IS_RUNNING_IN_DEVCONTAINER === 'true' || process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }
    return [];
  },

  // If you need to export the app statically in production
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
};

module.exports = nextConfig;
