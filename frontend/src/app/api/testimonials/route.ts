import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, route } from '@/server/http';
import { testimonialSchema } from './esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  return { items: await prisma.testimonial.findMany({ orderBy: { sortOrder: 'asc' } }) };
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, testimonialSchema);
  return NextResponse.json(await prisma.testimonial.create({ data: datos }), { status: 201 });
});
