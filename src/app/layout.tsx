import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Plus_Jakarta_Sans,
  Newsreader,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import "./studio.css";
import "./studio-v2.css";
import "./studio-v3.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NoteZ — A little space for big ideas",
  description:
    "A thoughtful workspace for your notes, voice memos, and ideas. Write clearly, stay organized, and think alongside AI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('notez-theme');
                if (saved === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:bg-indigo-400/25 dark:selection:text-indigo-100">
        {children}
      </body>
    </html>
  );
}
