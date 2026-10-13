export const voicePages = {
  stylist: "Stylist",
  wardrobe: "My Wardrobe",
  inventory: "Inventory",
  saved: "Saved Looks",
  fitting: "Fitting Room",
  orders: "My Orders",
  profile: "Profile",
  admin: "Seller Studio",
} as const;

export type VoicePage = keyof typeof voicePages;
export type VoiceDestination = VoicePage | "back" | "origin";

export function isVoiceDestination(value: unknown): value is VoiceDestination {
  return (
    typeof value === "string" &&
    (value === "back" || value === "origin" || Object.hasOwn(voicePages, value))
  );
}

export function voiceHistory(
  history: VoicePage[],
  target: VoiceDestination,
): VoicePage[] {
  const current = history.length ? history : ["stylist" as const];
  if (target === "origin") return [current[0]];
  if (target === "back")
    return current.length > 1 ? current.slice(0, -1) : current;
  if (current.at(-1) === target) return current;
  // Bound history while retaining the original screen for "where we started".
  return [
    ...(current.length >= 20 ? [current[0], ...current.slice(-18)] : current),
    target,
  ];
}
