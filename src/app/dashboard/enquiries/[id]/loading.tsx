import { ThreadSkeleton } from "@/components/enquiries/thread-skeleton";

/**
 * Shown the instant a conversation is picked, while its thread loads. Only
 * the thread pane is replaced — the list is in the layout and stays put.
 */
export default function Loading() {
  return <ThreadSkeleton />;
}
