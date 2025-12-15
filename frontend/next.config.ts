const getNextConfig = () => {
  const proxyClientMaxBodySizeValue = '4000mb';

  const lifecycle = process.env.npm_lifecycle_event;
  const explicitMode = process.env.NEXT_BUILD_MODE;

  // ------------------------------
  // Decide build mode
  // ------------------------------
  const buildMode =
    explicitMode ??
    (lifecycle === 'dev' ? 'dev' : 'export');

  // ------------------------------
  // DEV MODE
  // ------------------------------
  if (buildMode === 'dev') {
    return {
      experimental: {
        proxyClientMaxBodySize: proxyClientMaxBodySizeValue,
      },
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

  // ------------------------------
  // EXPORT MODE (build / CI / prod)
  // ------------------------------
  return {
    experimental: {
      proxyClientMaxBodySize: proxyClientMaxBodySizeValue,
    },
    output: 'export',
    images: {
      unoptimized: true,
    },
  };
};

module.exports = getNextConfig();
