/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote images from any https source
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Image optimization formats
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
