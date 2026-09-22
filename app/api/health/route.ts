import { auth } from '@clerk/nextjs/server';

export async function GET() {
  await auth.protect();
  return Response.json({ ok: true });
}
