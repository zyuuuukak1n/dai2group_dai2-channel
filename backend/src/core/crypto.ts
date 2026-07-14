import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function getJSTDateString(): string {
  const dt = new Date();
  // Ensure we are adding 9 hours to UTC time
  const utcMs = dt.getTime() + (dt.getTimezoneOffset() * 60000);
  const jstDt = new Date(utcMs + (9 * 60 * 60 * 1000));
  
  const year = jstDt.getFullYear();
  const month = String(jstDt.getMonth() + 1).padStart(2, '0');
  const day = String(jstDt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateDailyId(ip: string, salt: string): string {
  const dateStr = getJSTDateString();
  const rawData = `${ip}${dateStr}${salt}`;
  const hash = crypto.createHash('sha256').update(rawData).digest('base64');
  // Replace +, /, =
  const safeHash = hash.replace(/\+/g, 'a').replace(/\//g, 'b').replace(/=/g, '');
  return safeHash.substring(0, 8);
}

export function hashIp(ip: string, salt: string): string {
  const rawData = `${ip}${salt}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

export function generateTrip(password: string, salt: string): string {
  const rawData = `${password}${salt}`;
  const hash = crypto.createHash('sha256').update(rawData).digest('base64');
  return "◆" + hash.substring(0, 10);
}

export async function hashDeleteKey(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function compareDeleteKey(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
