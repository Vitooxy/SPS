import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPS Coding Framework - Interactive Visualization',
  description: 'Interactive alluvial diagram for the SPS Item Coding Framework (6-Axis)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Inspector keys={['command', 'i']} onInspectElement={undefined}>
          {children}
        </Inspector>
      </body>
    </html>
  );
}
