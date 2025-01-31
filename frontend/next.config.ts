/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
  
  // Uncomment if you plan to export the Next.js app as static files
  // output: 'export'
};

module.exports = nextConfig;
