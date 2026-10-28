import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "connect-src 'self' https://api.github.com https://api.deepseek.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://openrouter.ai",
            "img-src 'self' data: https://avatars.githubusercontent.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "frame-src 'self' blob:",
          ].join('; '),
        },
      ],
    },
  ],
};

export default nextConfig;
