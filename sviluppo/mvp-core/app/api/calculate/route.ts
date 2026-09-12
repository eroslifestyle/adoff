import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
  traffic: z.number().min(1, 'Traffic must be > 0'),
  cpm: z.number().min(0.1, 'CPM must be > 0.1'),
});

type CalculateRequest = z.infer<typeof RequestSchema>;

interface CalculateResponse {
  euroPersiAnno: number;
  euroPerMese: number;
  trafficoMensile: number;
  cpm: number;
  breakdown: {
    month: number;
    euro: number;
  }[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { traffic, cpm } = RequestSchema.parse(body);

    // Formula: (traffic/1000) * CPM * 12 * AD_BLOCK_FACTOR
    // AD_BLOCK_FACTOR default: 0.30 (30% ad block recovery)
    const adBlockFactor = parseFloat(process.env.AD_BLOCK_FACTOR || '0.30');

    const euroPerMese = (traffic / 1000) * cpm * adBlockFactor;
    const euroPersiAnno = euroPerMese * 12;

    // Monthly breakdown
    const breakdown = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      euro: Math.round(euroPerMese * 100) / 100,
    }));

    const response: CalculateResponse = {
      euroPersiAnno: Math.round(euroPersiAnno * 100) / 100,
      euroPerMese: Math.round(euroPerMese * 100) / 100,
      trafficoMensile: traffic,
      cpm,
      breakdown,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
