"use client";

import { MoonIcon, SunIcon } from "@/components/Icons";
import { STORAGE, writeString } from "@/lib/storage";

export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    writeString(STORAGE.theme, next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Переключить светлую и тёмную тему"
      title="Светлая / тёмная тема"
      className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted transition hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/10"
    >
      <SunIcon size={18} className="hidden dark:block" />
      <MoonIcon size={18} className="dark:hidden" />
    </button>
  );
}
