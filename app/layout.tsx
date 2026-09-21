import type { Metadata } from 'next';
import './globals.css';
import './campaign.css';
import './premium.css';

export const metadata: Metadata = {
  title: 'Startup Street — Lead Intelligence',
  description: 'Discover businesses, prove website gaps, and turn verified problems into sales conversations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
