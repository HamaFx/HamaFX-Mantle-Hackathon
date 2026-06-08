'use server';

// import { deleteAllThreads } from '@hamafx/ai';

export async function clearChatHistoryAction() {
  try {
    // await deleteAllThreads();
    return { ok: true as const };
  } catch (err) {
    console.error('[settings] clearChatHistoryAction failed', err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
