export const ENGINE_SLUG = "findmatch";

export function emitContainerEvent(
  userId: string | null,
  type: "trial_completed" | "summary_data",
  data: Record<string, unknown>,
): void {
  try {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        payload_id: `${ENGINE_SLUG}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        cr_user_id: userId,
        sub_app_id: ENGINE_SLUG,
        payload_version: "1.0",
        collection: type === "summary_data" ? "summary_data" : "user_sessions_data",
        timestamp: new Date().toISOString(),
        data,
      }),
    );
  } catch {
    // Reporting must never affect gameplay.
  }
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}
