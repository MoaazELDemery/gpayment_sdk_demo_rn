const SESSION_API =
  'https://api.merchant.geidea.net/payment-intent/api/v2/direct/Session';

const SESSION_AUTH =
  'Basic OTllMjBiNjItMmI3Ni00NDU1LThiMjctZWY3YTkyZDJkMWIzOmM0MjkzMzFiLTI1ZmEtNDRiMC05NGE1LTZkNWE5MmUzZWY3NQ==';

export async function createSession(): Promise<string> {
  const res = await fetch(SESSION_API, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: SESSION_AUTH,
      language: 'en',
    },
    body: JSON.stringify({
      amount: 6,
      order: {
        summary: { vat: 1, subtotal: 4, shipping: 1 },
        items: [
          {
            count: 1,
            name: 'Geidea POS',
            icon: 'https://d23r9m22xg868b.cloudfront.net/public/navbar-hardware-1-egy-mobile.png',
            Price: 4,
          },
        ],
      },
      signature: 'RwPREKTkV84difrsu31KK3MBmIS9rhyz/kWaXeSu42U=',
      initiatedBy: 'internet',
      currency: 'EGP',
      timeStamp: '2026-01-19T13:36:40.407Z',
      paymentOperation: 'Pay',
    }),
  });

  const data = await res.json();
  const id = data?.session?.id ?? data?.sessionId ?? data?.id;
  if (!id) throw new Error(data?.message ?? 'Failed to create session');
  return id;
}
