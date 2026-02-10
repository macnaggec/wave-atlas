import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "./globals.css";
import React from "react";
import { Providers } from "app/providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Wave Atlas',
  description: "easy buy or sell surf photos",
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'manifest',
        url: '/site.webmanifest',
      },
    ],
  },
};

/**
 * Root Layout (Server Component)
 *
 * Renders HTML structure and wraps app with composed client providers.
 * Clean HOC composition pattern - no deep nesting!
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
