import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "../core/constants.js";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(500),
  name: z.string().min(1).max(100),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});
