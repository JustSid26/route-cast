import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'RouteDemand · VRP Platform',
  description: 'Vehicle routing & optimization MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Providers>
          <Sidebar />
          <main style={{ marginLeft: 'var(--sidebar-w)' }} className="min-h-screen">
            <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
