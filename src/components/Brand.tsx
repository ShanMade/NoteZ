import React from "react";
import { BookOpen, CalendarDays, Compass, FileText, Lightbulb, Folder, Sparkles, ClipboardList, Briefcase, Rocket, type LucideIcon } from "lucide-react";

export function NoteZMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true" className={className}>
    <rect width="36" height="36" rx="11" fill="#7059E8"/>
    <path d="M10 25.5V10.5h3.2l9.6 10.2V10.5H26v15h-3.2l-9.6-10.2v10.2H10Z" fill="white"/>
    <circle cx="27.2" cy="8.8" r="2.2" fill="#C6B9FF" stroke="#7059E8" strokeWidth="1.4"/>
  </svg>;
}
export function NoteZLogo({ size = 31 }: { size?: number }) {
  return <span className="nz-brand"><NoteZMark size={size}/><span>note<span className="nz-brand-z">z</span><span className="nz-brand-dot">.</span></span></span>;
}
const documentIcons: Record<string, LucideIcon> = { file: FileText, book: BookOpen, calendar: CalendarDays, compass: Compass, lightbulb: Lightbulb, folder: Folder, sparkles: Sparkles, clipboard: ClipboardList, briefcase: Briefcase, rocket: Rocket };
export function DocumentIcon({ icon, size = 17, className = "" }: { icon?: string; size?: number; className?: string }) {
  const Icon = documentIcons[icon || "file"] || FileText;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden="true"/>;
}
