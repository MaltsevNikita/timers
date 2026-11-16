import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Таймеры — обратный отсчёт",
  description:
    "Несколько таймеров обратного отсчёта с паузой, своей мелодией, уведомлениями и тёмной темой.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0e" },
  ],
};

const themeScript = `(function(){try{var stored=localStorage.getItem("timers:theme");var dark=stored==="dark"||(stored===null&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");}catch(e){}})();`;

// Браузеры без поддержки ES-модулей (старые планшеты) уходят на лёгкую версию.
const legacyRedirect = `location.replace(${JSON.stringify(
  `${process.env.PAGES_BASE_PATH ?? ""}/lite/`,
)});`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script noModule dangerouslySetInnerHTML={{ __html: legacyRedirect }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
