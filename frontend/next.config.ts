/** @type {import('next').NextConfig} */
const getNextConfig = () => {
  if (process.env.IS_RUNNING_IN_DEVCONTAINER === 'true') {
    return {
      async rewrites() {
        console.log(
          'IS_RUNNING_IN_DEVCONTAINER:',
          process.env.IS_RUNNING_IN_DEVCONTAINER,
          'NODE_ENV:',
          process.env.NODE_ENV
        );
        return [
          {
            source: '/api/:path*',
            destination: 'http://localhost:5000/api/:path*',
          },
        ];
      },
    };
  } else {
    return {
      output: 'export',
      images: {
        unoptimized: true,
      },
    };
  }
};

module.exports = getNextConfig();
