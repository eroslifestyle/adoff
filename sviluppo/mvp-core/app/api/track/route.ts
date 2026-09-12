import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TrackSchema = z.object({
  event: z.enum(['click', 'signup', 'attivo', 'benchmark_selected', 'benchmark_report']),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  session_id: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

type TrackRequest = z.infer<typeof TrackSchema>;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const trackData = TrackSchema.parse(body);

    // TODO: In production, save to Vercel Postgres / database
    // For now, log and return success
    const timestamp = new Date().toISOString();
    const event = {
      timestamp,
      ...trackData,
    };

    console.log('[TRACK]', JSON.stringify(event));

    // Fire to Plausible if event type is relevant
    if (process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && request.headers.get('user-agent')) {
      // Plausible tracking (fire-and-forget)
      const plausibleEvent = {
        domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
        name: `calc:${trackData.event}`,
        url: request.headers.get('referer') || '/',
        props: {
          utm_source: trackData.utm_source || 'direct',
          utm_medium: trackData.utm_medium || 'organic',
          utm_campaign: trackData.utm_campaign || 'general',
        },
      };

      // Fire to Plausible asynchronously (no await)
      fetch('https://plausible.io/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plausibleEvent),
      }).catch(() => {
        // Silently fail if Plausible is down
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}
