/** @type {import('next').NextConfig} */
const nextConfig = {
  // needed for local dev
  /* 
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },*/
  
  // needed for pipeline to export the Next.js app as static files
  output: 'export'
};

module.exports = nextConfig;
