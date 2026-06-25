/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy browser API calls through the frontend server so a single public
  // origin (e.g. an ngrok tunnel) serves both the app and the API. The
  // destination is reached server-side over the Docker network.
  async rewrites() {
    const target = process.env.BACKEND_PROXY_TARGET || 'http://backend:4000';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

module.exports = nextConfig;
