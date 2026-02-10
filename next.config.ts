const nextConfig: import('next').NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@prisma/client');
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/dwiz044fs/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    API_TOKEN: process.env.API_TOKEN,
    API_HOST: process.env.API_HOST,
    CLIENT_HOST: process.env.CLIENT_HOST,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  },
};

export default nextConfig;
