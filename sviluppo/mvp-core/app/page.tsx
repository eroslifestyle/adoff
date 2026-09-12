'use client';

import { FormEvent, useState, useEffect } from 'react';

interface CalculationResult {
  euroPersiAnno: number;
  euroPerMese: number;
  trafficoMensile: number;
  cpm: number;
}

export default function Home() {
  const [traffic, setTraffic] = useState('');
  const [cpm, setCpm] = useState('');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get('utm_source');
    const utm_medium = params.get('utm_medium');
    const utm_campaign = params.get('utm_campaign');

    if (utm_source || utm_medium || utm_campaign) {
      sessionStorage.setItem(
        'adoff_utm',
        JSON.stringify({ utm_source, utm_medium, utm_campaign })
      );

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'click',
          utm_source: utm_source || 'direct',
          utm_medium: utm_medium || 'organic',
          utm_campaign: utm_campaign || 'general',
          session_id: getOrCreateSessionId(),
        }),
      }).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traffic: parseFloat(traffic),
          cpm: parseFloat(cpm),
        }),
      });

      if (!response.ok) {
        throw new Error('Calculation failed');
      }

      const data = await response.json();
      setResult(data);

      const utm = JSON.parse(sessionStorage.getItem('adoff_utm') || '{}');
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'attivo',
          utm_source: utm.utm_source || 'direct',
          utm_medium: utm.utm_medium || 'organic',
          utm_campaign: utm.utm_campaign || 'general',
          session_id: getOrCreateSessionId(),
          payload: { euroPersiAnno: data.euroPersiAnno },
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Scopri quanto perdi
        </h1>
        <p className="text-gray-600 mb-6">
          Calcolatore di perdite pubblicitarie. €/anno con gli ads.
        </p>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Traffico mensile (visitatori)
              </label>
              <input
                type="number"
                value={traffic}
                onChange={(e) => setTraffic(e.target.value)}
                placeholder="es. 10000"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPM medio (€)
              </label>
              <input
                type="number"
                value={cpm}
                onChange={(e) => setCpm(e.target.value)}
                placeholder="es. 2.5"
                step="0.1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Calcolo...' : 'Calcola'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-gray-700 text-sm mb-2">Perdi ogni anno:</p>
              <p className="text-4xl font-bold text-red-600">
                €{result.euroPersiAnno.toLocaleString('it-IT')}
              </p>
              <p className="text-gray-600 text-sm mt-2">
                €{result.euroPerMese.toLocaleString('it-IT')}/mese
              </p>
            </div>

            <button
              onClick={() => {
                fetch('/api/report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(result),
                })
                  .then((r) => r.json())
                  .then((report) => {
                    console.log('Report:', report);
                    alert(`Report generato: ${report.title}`);
                  })
                  .catch(() => alert('Error generating report'));
              }}
              className="w-full bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700"
            >
              Scarica Report PDF
            </button>

            <button
              onClick={() => setResult(null)}
              className="w-full bg-gray-300 text-gray-900 py-2 rounded-md font-semibold hover:bg-gray-400"
            >
              Nuovo calcolo
            </button>
          </div>
        )}

        <p className="text-gray-500 text-xs mt-6 text-center">
          Dati calcolati localmente. Nessun salvataggio.
        </p>
      </div>
    </main>
  );
}

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem('adoff_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('adoff_session_id', sessionId);
  }
  return sessionId;
}
