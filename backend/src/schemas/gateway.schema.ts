import { z } from "zod";

const messageSchema = z
  .object({
    role: z.string().min(1).max(30),
    content: z.unknown().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const chatCompletionSchema = z
  .object({
    model: z.string().min(1).max(100),
    messages: z.array(messageSchema).min(1),
    stream: z.boolean().optional(),
  })
  .passthrough();
