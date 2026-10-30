'use client';

import { useState } from 'react';

interface IndustryData {
  name: string;
  avgTraffic: number;
  avgCPM: number;
  recoveryRate: number;
}

const INDUSTRIES: IndustryData[] = [
  { name: 'Tech Blog', avgTraffic: 5000, avgCPM: 3.5, recoveryRate: 0.30 },
  { name: 'News Site', avgTraffic: 15000, avgCPM: 2.0, recoveryRate: 0.30 },
  { name: 'YouTube Creator', avgTraffic: 25000, avgCPM: 5.0, recoveryRate: 0.30 },
  { name: 'SaaS Blog', avgTraffic: 8000, avgCPM: 6.5, recoveryRate: 0.30 },
  { name: 'E-commerce', avgTraffic: 20000, avgCPM: 4.0, recoveryRate: 0.30 },
  { name: 'Gaming Site', avgTraffic: 30000, avgCPM: 3.0, recoveryRate: 0.30 },
  { name: 'Education', avgTraffic: 10000, avgCPM: 2.5, recoveryRate: 0.30 },
  { name: 'Lifestyle Blog', avgTraffic: 3000, avgCPM: 2.0, recoveryRate: 0.30 },
];

export default function Benchmark() {
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryData | null>(
    INDUSTRIES[0]
  );

  if (!selectedIndustry) return null;

  const euroPerAnno =
    (selectedIndustry.avgTraffic / 1000) *
    selectedIndustry.avgCPM *
    12 *
    selectedIndustry.recoveryRate;

  const euroPerMese = euroPerAnno / 12;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Scopri quanto perdi
        </h1>
        <p className="text-gray-600 mb-6">
          Seleziona il tuo settore per una stima istantanea
        </p>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Che tipo di sito gestisci?
          </label>
          <select
            value={INDUSTRIES.indexOf(selectedIndustry)}
            onChange={(e) => {
              setSelectedIndustry(INDUSTRIES[parseInt(e.target.value)]);
              fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'benchmark_selected',
                  utm_source: new URLSearchParams(window.location.search).get('utm_source') || 'direct',
                  utm_medium: 'benchmark',
                  utm_campaign: 'fallback',
                  session_id: getOrCreateSessionId(),
                  payload: { industry: INDUSTRIES[parseInt(e.target.value)].name },
                }),
              }).catch(() => {});
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {INDUSTRIES.map((ind, idx) => (
              <option key={idx} value={idx}>
                {ind.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p className="text-gray-700 text-sm mb-2">Stima perdite annuali:</p>
          <p className="text-5xl font-bold text-red-600 mb-3">
            €{Math.round(euroPerAnno).toLocaleString('it-IT')}
          </p>
          <p className="text-gray-600 text-sm">
            €{Math.round(euroPerMese).toLocaleString('it-IT')}/mese
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <p className="text-sm text-blue-900">
            📊 Basato su dati aggregati: {selectedIndustry.avgTraffic.toLocaleString(
              'it-IT'
            )}{' '}
            visite/mese, CPM medio €{selectedIndustry.avgCPM}/1000
          </p>
        </div>

        <button
          onClick={() => {
            fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'benchmark_report',
                utm_source: new URLSearchParams(window.location.search).get('utm_source') || 'direct',
                utm_medium: 'benchmark',
                utm_campaign: 'fallback',
                session_id: getOrCreateSessionId(),
                payload: { euroPerAnno },
              }),
            }).catch(() => {});
            alert(`Hai identificato una perdita di €${Math.round(euroPerAnno)}/anno.

Prossime azioni:
1. Usa un ad blocker per proteggere il tuo traffico
2. Raccogli dati dai tuoi sistemi di monetizzazione
3. Implementa una strategia di ottimizzazione nel tuo team

Altro: adoff.app`);
          }}
          className="w-full bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700"
        >
          Scarica Report
        </button>

        <p className="text-gray-500 text-xs mt-6 text-center">
          Dati calcolati localmente. Nessun salvataggio.
        </p>
      </div>
    </main>
  );
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('adoff_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('adoff_session_id', sessionId);
  }
  return sessionId;
}
