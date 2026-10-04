import { canLookUp, lookUpRate, RATES_API } from '../rates';

type Reply = { ok: boolean; body?: unknown };

/** A stand-in for fetch that answers from a table and records what was asked. */
function fakeFetch(replies: Record<string, Reply | Error>) {
  const asked: string[] = [];
  const fetcher = jest.fn(async (url: string) => {
    asked.push(url.replace(RATES_API, ''));
    const reply = replies[url.replace(RATES_API, '')];
    if (!reply) throw new Error(`Unexpected request ${url}`);
    if (reply instanceof Error) throw reply;
    return { ok: reply.ok, json: async () => reply.body };
  });
  return { fetcher, asked };
}

describe('looking up a rate', () => {
  it('asks for the expense’s date, and keeps the rate the way round that reads above one', async () => {
    const { fetcher, asked } = fakeFetch({ '/2026-09-28?base=GBP&symbols=JPY': { ok: true, body: { date: '2026-09-28', rates: { JPY: 208.08 } } } });
    await expect(lookUpRate('GBP', 'JPY', '2026-09-28', fetcher)).resolves.toEqual({ ok: true, quote: { rate: { base: 'GBP', value: '208.08' }, date: '2026-09-28' } });
    expect(asked).toEqual(['/2026-09-28?base=GBP&symbols=JPY']);
  });

  it('turns round a rate below one by asking the other way', async () => {
    const { fetcher, asked } = fakeFetch({
      '/2026-09-28?base=JPY&symbols=GBP': { ok: true, body: { date: '2026-09-28', rates: { GBP: 0.0048 } } },
      '/2026-09-28?base=GBP&symbols=JPY': { ok: true, body: { date: '2026-09-28', rates: { JPY: 208.08 } } },
    });
    await expect(lookUpRate('JPY', 'GBP', '2026-09-28', fetcher)).resolves.toEqual({ ok: true, quote: { rate: { base: 'GBP', value: '208.08' }, date: '2026-09-28' } });
    expect(asked).toHaveLength(2);
  });

  it('passes on the date the ECB actually published, on a weekend', async () => {
    const { fetcher } = fakeFetch({ '/2026-10-04?base=EUR&symbols=USD': { ok: true, body: { date: '2026-10-02', rates: { USD: 1.1612 } } } });
    const result = await lookUpRate('EUR', 'USD', '2026-10-04', fetcher);
    expect(result.ok && result.quote.date).toBe('2026-10-02');
  });

  it('says when a currency has no ECB rate, without asking', async () => {
    const { fetcher } = fakeFetch({});
    await expect(lookUpRate('GBP', 'VND', '2026-09-28', fetcher)).resolves.toEqual({ ok: false, reason: 'unsupported' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(canLookUp('GBP', 'GBP')).toBe(false);
  });

  it('tells a lost connection from a bad reply', async () => {
    const offline = fakeFetch({ '/2026-09-28?base=GBP&symbols=JPY': new TypeError('Network request failed') });
    await expect(lookUpRate('GBP', 'JPY', '2026-09-28', offline.fetcher)).resolves.toEqual({ ok: false, reason: 'offline' });
    const refused = fakeFetch({ '/2026-09-28?base=GBP&symbols=JPY': { ok: false } });
    await expect(lookUpRate('GBP', 'JPY', '2026-09-28', refused.fetcher)).resolves.toEqual({ ok: false, reason: 'failed' });
    const garbled = fakeFetch({ '/2026-09-28?base=GBP&symbols=JPY': { ok: true, body: { rates: { JPY: 'lots' } } } });
    await expect(lookUpRate('GBP', 'JPY', '2026-09-28', garbled.fetcher)).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});
