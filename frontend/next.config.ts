/** @type {import('next').NextConfig} */
const getNextConfig = () => {

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
            destination: 'http://127.0.0.1:5000/api/:path*',
          },
        ];
      },
    };
};

module.exports = getNextConfig();
