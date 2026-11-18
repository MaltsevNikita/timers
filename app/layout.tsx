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
    // На телефонах и планшетах приложение по умолчанию тёмное.
    { media: "(pointer: coarse)", color: "#0a0b0e" },
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0e" },
  ],
};

const themeScript = `(function(){try{
var stored=localStorage.getItem("timers:theme");
var mq=window.matchMedia;
var dark;
if(stored==="dark"){dark=true;}
else if(stored==="light"){dark=false;}
else{
  var mobile=!!(mq&&(mq("(pointer: coarse)").matches||mq("(max-width: 640px)").matches));
  dark=mobile||!!(mq&&mq("(prefers-color-scheme: dark)").matches);
}
if(dark)document.documentElement.classList.add("dark");
}catch(e){}})();`;

// Старые браузеры (включая Chrome 61–110) уходят на лёгкую ES5-версию:
// проверяем поддержку color-mix(), на которую рассчитан Tailwind 4 и Next 16.
const legacyPath = `${process.env.PAGES_BASE_PATH ?? ""}/lite/`;
const legacyRedirect = `(function(){try{if(window.CSS&&CSS.supports&&CSS.supports("color","color-mix(in srgb, red, blue)")){return;}}catch(e){}location.replace(${JSON.stringify(legacyPath)});})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: legacyRedirect }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
