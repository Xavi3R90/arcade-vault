import type { Metadata, Viewport } from 'next'
import { Press_Start_2P, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const pressStart2P = Press_Start_2P({
  variable: '--font-pixel',
  subsets: ['latin'],
  weight: '400',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Arcade Vault',
  description: 'Online gaming platform where players compete for the highest score',
}

// Sin maximumScale/userScalable: el zoom de accesibilidad se mantiene en todo el sitio.
// El bloqueo de gestos se aplica solo al área de juego (SPEC 10).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${pressStart2P.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
