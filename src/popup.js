let usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

async function generateHMAC(message, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const keyData = encoder.encode(secret);

  const key = await window.crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-384' }, false, ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
}

async function fetchAndDisplayOrders() {
  const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);

  const apiUrl = 'https://api.bitfinex.com/v2/auth/r/orders/tBTCUST';
  const nonce = Date.now().toString();
  const signature = `/api/v2/auth/r/orders/tBTCUST${nonce}`;
  const sigHash = await generateHMAC(signature, apiSecret);

  const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
          'bfx-nonce': nonce,
          'bfx-apikey': apiKey,
          'bfx-signature': sigHash
      }
  });

  const orders = await response.json();

  const ordersTable = document.getElementById('orders');
  orders.forEach(order => {
      const row = ordersTable.insertRow();
      row.insertCell().innerText = usdFormatter.format(order[16]); // Price (USDT)
      row.insertCell().innerText = order[6]; // Amount (BTC)
      // Add the 'x' icon and event listener
      const cancelCell = row.insertCell();
      const cancelIcon = document.createElement('span');
      cancelIcon.innerText = '🗑️';
      cancelIcon.style.cursor = 'pointer';
      cancelIcon.addEventListener('click', () => cancelOrder(order[0]));
      cancelCell.appendChild(cancelIcon);
  });
}

async function executeTrade() {
  const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);

  const apiUrl = 'https://api.bitfinex.com/v2/auth/w/order/submit';
  const nonce = Date.now().toString();

  // Construct the order details
  const body = {
      symbol: 'tBTCUST',  // trading pair symbol
      cid: Date.now(),  // client order ID, can be any unique number
      type: 'EXCHANGE MARKET',
      amount: '0.00006',  // the amount in BTC to buy
      price: '1',  // For market orders, this can be any number but is ignored by the platform
      side: 'buy'
  };

  const rawBody = JSON.stringify(body);
  const signature = `/api/v2/auth/w/order/submit${nonce}${rawBody}`;
  const sigHash = await generateHMAC(signature, apiSecret);

  const response = await fetch(apiUrl, {
      method: 'POST',
      body: rawBody,
      headers: {
          'bfx-nonce': nonce,
          'bfx-apikey': apiKey,
          'bfx-signature': sigHash,
          'Content-Type': 'application/json'
      }
  });

  const data = await response.json();

  console.log('Order submission response:', data);

  if (data[6] === 'SUCCESS') {
    return true
  }

  alert('Order submission failed!: ' + JSON.stringify(data));
  return false
}


async function cancelOrder(orderId) {
  const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);

  const apiUrl = `https://api.bitfinex.com/v2/auth/w/order/cancel`;
  const nonce = Date.now().toString();
  const body = JSON.stringify({
      id: orderId
  });
  const signature = `/api/v2/auth/w/order/cancel${nonce}${body}`;
  const sigHash = await generateHMAC(signature, apiSecret);

  const response = await fetch(apiUrl, {
      method: 'POST',
      body: body,
      headers: {
          'bfx-nonce': nonce,
          'bfx-apikey': apiKey,
          'bfx-signature': sigHash,
          'Content-Type': 'application/json'
      }
  });

  await response.json();
  window.location.reload();
}

// ... existing code ...

async function updateBalances() {
  const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);

  const apiUrl = `https://api.bitfinex.com/v2/auth/r/wallets`;
  const nonce = Date.now().toString();
  const body = {};
  const signature = `/api/v2/auth/r/wallets${nonce}${JSON.stringify(body)}`;
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

  const wallets = await response.json();
  // log
  console.log(wallets);

  const btcWallet = wallets.find(wallet => wallet[1] === "BTC");
  const ustWallet = wallets.find(wallet => wallet[1] === "UST");

  const btcBalanceElement = document.getElementById('btc-balance');
  const ustBalanceElement = document.getElementById('ust-balance');

  if (btcWallet) {
      btcBalanceElement.innerText = btcWallet[2].toFixed(4); // Displaying up to 4 decimal points for BTC
  } else {
      btcBalanceElement.innerText = '0.0000';
  }

  if (ustWallet) {
      ustBalanceElement.innerText = usdFormatter.format(ustWallet[2].toFixed(0)); // Displaying up to 2 decimal points for UST
  } else {
      ustBalanceElement.innerText = '0.00';
  }
}

async function updateBtcStats() {
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
  let totalAmount = 0;
  let totalPrice = 0;

  // log
  console.log(trades);

  trades.forEach(trade => {
      if (trade[4] > 0) { // Buys only
          totalAmount += trade[4];
          totalPrice += trade[4] * trade[5]; // Assuming trade[5] is the price
      }
  });

  const avgPrice = totalPrice / totalAmount;

  document.getElementById('avg-price').innerText = usdFormatter.format(avgPrice.toFixed(2));
  document.getElementById('btc-bought').innerText = totalAmount.toFixed(4);
  document.getElementById('usdt-spent').innerText = usdFormatter.format(totalPrice.toFixed(0));
}

// Toggle the settings div visibility
document.getElementById('settingsBtn').addEventListener('click', function() {
  const settingsDiv = document.getElementById('settingsModal');
  if (settingsDiv.style.display === 'none') {
      settingsDiv.style.display = 'block';
  } else {
      settingsDiv.style.display = 'none';
  }
});

// Save settings to chrome.storage.local
document.getElementById('saveSettingsBtn').addEventListener('click', async function() {
  const apiKey = document.getElementById('apiKeyInput').value;
  const apiSecret = document.getElementById('apiSecretInput').value;

  await chrome.storage.local.set({ apiKey, apiSecret });
  alert('Settings saved!');
});

// Clear settings from chrome.storage.local
document.getElementById('clearSettingsBtn').addEventListener('click', async function() {
  await chrome.storage.local.remove(['apiKey', 'apiSecret']);
  document.getElementById('apiKeyInput').value = '';
  document.getElementById('apiSecretInput').value = '';
  alert('Settings cleared!');
});

// Close the settings div when the user clicks outside of it
document.getElementById('closeSettingsBtn').addEventListener('click', async function() {
  const settingsDiv = document.getElementById('settingsModal');
    settingsDiv.style.display = 'none';
});

document.getElementById('buyNow').addEventListener('click', async function() {
  const result = await executeTrade();
  if (result) window.location.reload();
});

// Update BTC stats when the popup is loaded
document.addEventListener('DOMContentLoaded', async function() {
  await updateBtcStats()
  await updateBalances()
  await fetchAndDisplayOrders()
});
