// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/', destination: '/home-test', permanent: false },
    ];
  },
};
module.exports = nextConfig;
