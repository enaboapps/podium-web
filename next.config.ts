import type { NextConfig } from 'next';

// npm_package_version is injected by npm when running any npm script
const version = process.env.npm_package_version ?? '0';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
