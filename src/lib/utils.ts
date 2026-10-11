import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export const terminal = (status: string) =>
  ["succeeded", "failed", "cancelled"].includes(status);
export const pollingMilliseconds = (duration: string) =>
  Math.max(1000, Number.parseFloat(duration) * 1000 || 5000);
