import type { Conversation, Profile } from "./types";

export function shoppingReady(profile: Profile | undefined) {
  return !!(
    profile?.onboarding_complete &&
    profile.clothing_size?.trim() &&
    profile.shoe_size?.trim()
  );
}

// Only resume a chat the customer chose. A missing/stale selection starts fresh.
export function selectedConversation(
  conversations: Conversation[],
  selectedId: string | null,
) {
  return selectedId
    ? conversations.find((c) => c.id === selectedId)
    : undefined;
}
