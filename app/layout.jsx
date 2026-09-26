import './globals.css';
import { AuthProvider } from '../lib/AuthProvider';
import AppShell from '../components/layout/AppShell';

export const metadata = {
  metadataBase: new URL('https://claudesounds.arx-app.com'),
  title: 'ClaudeSounds — Distribution, Publishing & Marketing',
  description:
    'ClaudeSounds helps independent artists and labels deliver releases to every major streaming store, register publishing splits and run marketing campaigns from one dashboard.',
  applicationName: 'ClaudeSounds',
  openGraph: {
    title: 'ClaudeSounds — Distribution, Publishing & Marketing',
    description:
      'Deliver releases to Spotify, Apple Music and more, register publishing works and track royalties in one place.',
    url: 'https://claudesounds.arx-app.com',
    siteName: 'ClaudeSounds',
    type: 'website'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e0d13'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="app-body">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}