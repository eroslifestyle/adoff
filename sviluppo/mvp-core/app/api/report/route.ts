import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ReportSchema = z.object({
  euroPersiAnno: z.number(),
  euroPerMese: z.number(),
  trafficoMensile: z.number(),
  cpm: z.number(),
  email: z.string().email().optional(),
});

type ReportRequest = z.infer<typeof ReportSchema>;

/**
 * Generates a PDF report with LLM-generated analysis.
 * In production: calls LLM to generate personalized insights, then returns PDF stream.
 * For MVP: returns a JSON template with fallback text if LLM timeout.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { euroPersiAnno, euroPerMese, trafficoMensile, cpm } = ReportSchema.parse(body);

    // Generate LLM insights (with 15s timeout + fallback)
    let insights = '';
    try {
      const llmResponse = await Promise.race([
        generateInsights(euroPersiAnno, trafficoMensile, cpm),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 15000)
        ),
      ]);
      insights = llmResponse;
    } catch (error) {
      // Fallback to static template
      insights = `
Hai identificato una perdita significativa di €${euroPersiAnno}/anno a causa della pubblicità.

Questo importo rappresenta il costo implicito del traffico che subisce l'impatto degli annunci pubblicitari.

Ecco 3 azioni immediate:
1. Valuta un ad blocker universale come AdOff per proteggere il tuo network
2. Raccogli i dati dei costi pubblicitari da tutte le piattaforme che usi
3. Implementa una strategia di ottimizzazione dei costi pubblicitari nel tuo team

Ulteriori informazioni su come ridurre questo costo sono disponibili su adoff.app.
      `;
    }

    // TODO: In production, generate actual PDF using react-pdf/renderer
    // For MVP, return JSON with report data that can be displayed client-side
    const reportData = {
      title: 'AdOff Ad Loss Report',
      generatedAt: new Date().toISOString(),
      data: {
        euroPersiAnno,
        euroPerMese,
        trafficoMensile,
        cpm,
      },
      insights,
    };

    return NextResponse.json(reportData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
  }
}

async function generateInsights(
  euroPerAnno: number,
  traffic: number,
  cpm: number
): Promise<string> {
  const llmBaseUrl = process.env.LLM_BASE_URL;
  const llmKey = process.env.LLM_API_KEY;
  const llmModel = process.env.LLM_MODEL;

  if (!llmBaseUrl || !llmKey) {
    throw new Error('LLM not configured');
  }

  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llmKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: llmModel || 'chat-max',
      messages: [
        {
          role: 'system',
          content:
            'Sei un consulente di strategie pubblicitarie esperti. Fornisci insights brevi (100-150 parole) in italiano su come ridurre le perdite pubblicitarie.',
        },
        {
          role: 'user',
          content: `L'utente perde €${Math.round(euroPerAnno)}/anno a causa della pubblicità. Ha ${traffic} visite/mese con CPM medio €${cpm}. Fornisci 3 azioni concrete e specifiche per ridurre questo costo.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    throw new Error('LLM request failed');
  }

  return data.choices[0].message.content;
}
