import { z } from 'zod';

export const schema = z.object({}).optional();
export type OutputType = { files: Array<{ id: string; title: string; audio_url: string; download_url: string; created_at: number }> };
