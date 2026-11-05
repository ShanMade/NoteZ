import React from "react";
import Image from "next/image";
import { BookOpen, CalendarDays, Compass, FileText, Lightbulb, Folder, Sparkles, ClipboardList, Briefcase, Rocket, type LucideIcon } from "lucide-react";

export function ByNoteMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="ByNote Logo"
      width={size}
      height={size}
      priority
      className={`inline-block select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Backward-compatible alias
export const NoteZMark = ByNoteMark;

export function ByNoteLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="nz-brand inline-flex items-center gap-2 font-semibold tracking-tight">
      <ByNoteMark size={size} />
      <span className="nz-brand-name text-[17px] font-bold text-[var(--text-primary)]">
        By<span className="text-[var(--accent)]">Note</span>
      </span>
    </span>
  );
}

// Backward-compatible alias
export const NoteZLogo = ByNoteLogo;

const documentIcons: Record<string, LucideIcon> = {
  file: FileText,
  book: BookOpen,
  calendar: CalendarDays,
  compass: Compass,
  lightbulb: Lightbulb,
  folder: Folder,
  sparkles: Sparkles,
  clipboard: ClipboardList,
  briefcase: Briefcase,
  rocket: Rocket,
};

export function DocumentIcon({
  icon,
  size = 17,
  className = "",
}: {
  icon?: string;
  size?: number;
  className?: string;
}) {
  const Icon = documentIcons[icon || "file"] || FileText;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
}
