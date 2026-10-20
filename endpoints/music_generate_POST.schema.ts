import { z } from 'zod';
import superjson from 'superjson';

export const schema = z.object({
  lyrics: z.string().optional(),
  creative_instruction: z.string().optional(),
  lyric_style: z.string().optional(),
  duration: z.number().optional(),
  style: z.string().optional(),
  voice: z.string().optional(),
  timbre: z.string().optional(),
  bpm: z.number().optional(),
  key: z.string().optional(),
  vocal_emotion: z.string().optional(),
  vocal_delivery: z.string().optional(),
  song_structure: z.array(z.string()).optional(),
  arrangement_note: z.string().optional(),
  music_production_instruction: z.string().optional(),
  singer_reference: z.string().optional(),
  song_reference: z.string().optional(),
  qualityControl: z.string().optional(),
  regenerate_section: z.string().optional(),
  exclude_styles: z.string().optional(),
  vocal_gender: z.string().optional(),
  weirdness: z.number().optional(),
  style_influence: z.number().optional(),
  variety: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = {
  status: string;
  task_id?: string;
  audio_url?: string;
  download_url?: string;
  provider: string;
  style?: string;
  bpm?: number;
  key?: string;
  duration?: number;
  queue_position?: number;
  quality_control?: string;
  music_production_instruction?: string;
};

export const postMusicGenerate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/music_generate`, {
    method: 'POST',
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
