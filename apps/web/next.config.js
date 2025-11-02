/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Get WebSocket URL from environment variable
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4001';
    const wsHost = wsUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').split('/')[0].split(':')[0];
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "object-src 'none'",
              "font-src 'self' data:",
              `connect-src 'self' ws://localhost:* http://localhost:* https://localhost:* https: wss://${wsHost} https://${wsHost}`,
              "frame-src 'self' https://open.spotify.com",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Fix for MetaMask SDK trying to use React Native packages in web environment
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      '@react-native-community/netinfo': false,
      'react-native': false,
      'react-native-webview': false,
      'pino-pretty': false,
    };
    return config;
  },
};

module.exports = nextConfig;
