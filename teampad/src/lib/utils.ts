import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  "bg-red-100 text-red-700",       // A
  "bg-orange-100 text-orange-700", // B
  "bg-amber-100 text-amber-700",   // C
  "bg-yellow-100 text-yellow-700", // D
  "bg-lime-100 text-lime-700",     // E
  "bg-green-100 text-green-700",   // F
  "bg-emerald-100 text-emerald-700", // G
  "bg-teal-100 text-teal-700",     // H
  "bg-cyan-100 text-cyan-700",     // I
  "bg-sky-100 text-sky-700",       // J
  "bg-blue-100 text-blue-700",     // K
  "bg-indigo-100 text-indigo-700", // L
  "bg-violet-100 text-violet-700", // M
  "bg-purple-100 text-purple-700", // N
  "bg-fuchsia-100 text-fuchsia-700", // O
  "bg-pink-100 text-pink-700",     // P
  "bg-rose-100 text-rose-700",     // Q
  "bg-slate-100 text-slate-700",   // R
  "bg-gray-100 text-gray-700",     // S
  "bg-zinc-100 text-zinc-700",     // T
  "bg-neutral-100 text-neutral-700", // U
  "bg-stone-100 text-stone-700",   // V
  "bg-red-200 text-red-800",       // W
  "bg-blue-200 text-blue-800",     // X
  "bg-green-200 text-green-800",   // Y
  "bg-purple-200 text-purple-800", // Z
];

/**
 * Returns a consistent color class string based on the input string.
 * Tries to map the first letter (A-Z) to an index 0-25.
 * Fallbacks to simple hashing.
 */
export function getUserColor(id: string) {
  if (!id) return COLORS[0];

  // Try to use the first letter if it's alphanumeric
  const firstChar = id.charAt(0).toUpperCase();
  if (/[A-Z]/.test(firstChar)) {
    const index = firstChar.charCodeAt(0) - 65; // A=65 -> 0
    if (index >= 0 && index < COLORS.length) {
      return COLORS[index];
    }
  }

  // Fallback hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}
