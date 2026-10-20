import { z } from 'zod';
export const schema = z.object({ task_id: z.string().min(1) });
export type InputType = z.infer<typeof schema>;
export type OutputType = { status: string; task_id: string; audio_url?: string; download_url?: string; error?: string };
