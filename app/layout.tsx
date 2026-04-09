import type { Metadata, Viewport } from 'next';
import { Inter, Lora } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const lora = Lora({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Podium',
  description: 'Deliver speeches with confidence.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Podium',
  },
  icons: {
    icon: [
      { url: '/icons/icon-16x16.png',  sizes: '16x16',  type: 'image/png' },
      { url: '/icons/icon-32x32.png',  sizes: '32x32',  type: 'image/png' },
      { url: '/icons/icon-48x48.png',  sizes: '48x48',  type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} ${lora.variable} font-sans bg-background text-foreground antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION}')` }} />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
