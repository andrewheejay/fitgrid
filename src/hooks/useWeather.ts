import { useEffect, useState } from 'react';

export interface Weather {
  summary: string;
  city: string;
}

/**
 * Real weather, fetched client-side, for one fixed city.
 *
 * Open-Meteo needs no API key and sends permissive CORS headers, so the chip
 * can be genuinely live with no backend. The location is fixed rather than the
 * browser's geolocation: a permission prompt on first load of a shared link is
 * hostile, and the design draws a specific city into the layout.
 */
const CITY = { name: 'Philadelphia', latitude: 39.9526, longitude: -75.1652 };

const FALLBACK: Weather = { summary: '11°C overcast', city: CITY.name };

/** WMO weather codes, collapsed to the vocabulary the chip has room for. */
function describe(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'fair';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow';
  return 'storm';
}

export function useWeather(): Weather {
  const [weather, setWeather] = useState<Weather>(FALLBACK);

  useEffect(() => {
    const controller = new AbortController();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${CITY.latitude}` +
      `&longitude=${CITY.longitude}&current=temperature_2m,weather_code`;

    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { current?: { temperature_2m?: number; weather_code?: number } }) => {
        const temperature = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (temperature === undefined || code === undefined) return;
        setWeather({
          summary: `${Math.round(temperature)}°C ${describe(code)}`,
          city: CITY.name,
        });
      })
      // A failed forecast is not worth surfacing; the seeded value stands in.
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  return weather;
}
