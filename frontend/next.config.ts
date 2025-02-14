
const getNextConfig = () => {
  if (process.env.IS_RUNNING_IN_DEVCONTAINER === 'true') {
    return {
      async rewrites() {
        console.warn('IS_RUNNING_IN_DEVCONTAINER');
        return [
          {
            source: '/api/:path*',
            destination: 'http://127.0.0.1:5000/api/:path*',
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
