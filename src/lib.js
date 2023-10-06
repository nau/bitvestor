
async function generateHMAC(message, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-384' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
}

async function getTodaysTrades() {
  const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startTimestamp = startOfDay.getTime();
  const endTimestamp = endOfDay.getTime();

  const body = {
      start: startTimestamp,
      end: endTimestamp,
  };

  const apiUrl = `https://api.bitfinex.com/v2/auth/r/trades/tBTCUST/hist`;
  const nonce = Date.now().toString();
  const signature = `/api/v2/auth/r/trades/tBTCUST/hist${nonce}${JSON.stringify(body)}`;
  const sigHash = await generateHMAC(signature, apiSecret);

  const response = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
          'bfx-nonce': nonce,
          'bfx-apikey': apiKey,
          'bfx-signature': sigHash,
          'Content-Type': 'application/json'
      }
  });

  const trades = await response.json();
  return trades.map(trade => {
      return {
          id: trade[0],
          symbol: trade[1],
          timestamp: trade[2],
          amount: trade[4],
          price: trade[5],
      }
  })
}
