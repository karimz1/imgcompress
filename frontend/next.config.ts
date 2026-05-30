const getNextConfig = () => {
  const lifecycle = process.env.npm_lifecycle_event;
  const explicitMode = process.env.NEXT_BUILD_MODE;
  const proxyClientMaxBodySize = process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE;
  const proxyBodySizeConfig = proxyClientMaxBodySize
    ? {
        experimental: {
          proxyClientMaxBodySize,
        },
      }
    : {};

  const buildMode =
    explicitMode ??
    (lifecycle === 'dev' ? 'dev' : 'export');

  if (buildMode === 'dev') {
    return {
      ...proxyBodySizeConfig,
      async rewrites() {
        return [
          {
            source: '/api/:path*',
            destination: 'http://127.0.0.1:5000/api/:path*',
          },
        ];
      },
    };
  }

  return {
    ...proxyBodySizeConfig,
    output: 'export',
    images: {
      unoptimized: true,
    },
  };
};

module.exports = getNextConfig();
