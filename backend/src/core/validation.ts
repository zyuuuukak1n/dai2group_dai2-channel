export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateThreadCreation(input: any) {
  if (!input.title || typeof input.title !== 'string' || input.title.length < 1 || input.title.length > 60) {
    throw new ValidationError('タイトルは1文字以上、60文字以内で入力してください。');
  }
  if (!input.body || typeof input.body !== 'string' || input.body.length < 1 || input.body.length > 2000) {
    throw new ValidationError('本文は1文字以上、2000文字以内で入力してください。');
  }
  if (input.authorName && (typeof input.authorName !== 'string' || input.authorName.length > 30)) {
    throw new ValidationError('名前は30文字以内で入力してください。');
  }
  if (input.password && (typeof input.password !== 'string' || input.password.length > 20)) {
    throw new ValidationError('パスワードは20文字以内で入力してください。');
  }
  if (input.mail && (typeof input.mail !== 'string' || input.mail.length > 30)) {
    throw new ValidationError('メールアドレスは30文字以内で入力してください。');
  }
}

export function validatePostCreation(input: any) {
  if (!input.body || typeof input.body !== 'string' || input.body.length < 1 || input.body.length > 2000) {
    throw new ValidationError('本文は1文字以上、2000文字以内で入力してください。');
  }
  if (input.authorName && (typeof input.authorName !== 'string' || input.authorName.length > 30)) {
    throw new ValidationError('名前は30文字以内で入力してください。');
  }
  if (input.password && (typeof input.password !== 'string' || input.password.length > 20)) {
    throw new ValidationError('パスワードは20文字以内で入力してください。');
  }
  if (input.mail && (typeof input.mail !== 'string' || input.mail.length > 30)) {
    throw new ValidationError('メールアドレスは30文字以内で入力してください。');
  }
}
