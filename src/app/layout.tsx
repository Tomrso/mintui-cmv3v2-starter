import './globals.css'
import { Inter, Merriweather } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'What Have You Found?',
  description: 'Fractured Apes Puzzle',
  robots: 'noindex'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
