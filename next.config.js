/** @type {import("next").NextConfig} */
const nextConfig={
  async redirects(){
    return [{ source: "/signin", destination: "/signin2", permanent: false }];
  },
};
module.exports = nextConfig;
