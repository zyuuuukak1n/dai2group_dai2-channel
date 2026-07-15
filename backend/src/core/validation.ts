import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const ThreadCreationSchema = z.object({
  title: z.string().min(1, 'タイトルは1文字以上で入力してください。').max(60, 'タイトルは60文字以内で入力してください。'),
  body: z.string().min(1, '本文は1文字以上で入力してください。').max(2000, '本文は2000文字以内で入力してください。'),
  authorName: z.string().max(30, '名前は30文字以内で入力してください。').optional().nullable(),
  password: z.string().max(20, 'パスワードは20文字以内で入力してください。').optional().nullable(),
  mail: z.string().max(30, 'メールアドレスは30文字以内で入力してください。').optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  deviceId: z.string().optional().nullable(),
});

export function validateThreadCreation(input: any) {
  const result = ThreadCreationSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error?.issues?.[0]?.message || 'Validation failed');
  }
}

const PostCreationSchema = z.object({
  body: z.string().min(1, '本文は1文字以上で入力してください。').max(2000, '本文は2000文字以内で入力してください。'),
  authorName: z.string().max(30, '名前は30文字以内で入力してください。').optional().nullable(),
  password: z.string().max(20, 'パスワードは20文字以内で入力してください。').optional().nullable(),
  mail: z.string().max(30, 'メールアドレスは30文字以内で入力してください。').optional().nullable(),
  mediaUrl: z.string().url().optional().nullable(),
  deviceId: z.string().optional().nullable(),
});

export function validatePostCreation(input: any) {
  const result = PostCreationSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error?.issues?.[0]?.message || 'Validation failed');
  }
}
