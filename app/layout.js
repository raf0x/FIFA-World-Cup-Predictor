import './globals.css';

export const metadata = {
  title: 'World Cup 2026 Predictor',
  description:
    'Pick group winners, runners-up, and the 8 best third-place teams for the 2026 FIFA World Cup.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
