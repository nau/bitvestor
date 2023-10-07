let usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

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
  console.log('Wallets', wallets);

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

function showTodaysTrades(trades) {
  const tradesTable = document.getElementById('today-trades');
  const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  trades.forEach(trade => {
      const row = tradesTable.insertRow();
      row.insertCell().innerText = new Date(trade.timestamp).toLocaleTimeString('en-US', options); // Time
      row.insertCell().innerText = usdFormatter.format(trade.price.toFixed(0)); // Price
      row.insertCell().innerText = trade.amount.toFixed(4); // Amount
      row.insertCell().innerText = usdFormatter.format(trade.amount * trade.price); // Total
  });
}

function updateBtcStats(trades, dailyTotal) {
  let totalAmount = 0;
  let totalPrice = 0;

  // log
  console.log('Trades', trades);

  trades.forEach(trade => {
      if (trade.amount > 0) { // Buys only
          totalAmount += trade.amount;
          totalPrice += trade.amount * trade.price;
      }
  });

  const avgPrice = totalAmount > 0.0 ? totalPrice / totalAmount : 0.0;
  const dailyProgress = (totalPrice / dailyTotal * 100);
  console.log('dailyProgress: ', dailyProgress, ' dailyTotal: ', dailyTotal, ' totalPrice: ', totalPrice);

  document.getElementById('avg-price').innerText = usdFormatter.format(avgPrice.toFixed(2));
  document.getElementById('btc-bought').innerText = totalAmount.toFixed(4);
  document.getElementById('usdt-spent').innerText = usdFormatter.format(totalPrice.toFixed(0));
  document.getElementById('dailyProgress').value = dailyProgress.toFixed(0);
}

function updateLastPrice() {
  chrome.storage.session.get("lastPrice").then((result) => {
    console.log('lastPrice: ', result.lastPrice);
    let price = result.lastPrice || 0;
    document.getElementById('last-price').innerText = usdFormatter.format(price);
  })
}

function daylyAmount() {
  const dailyAmountInput = document.getElementById('dailyAmount');
  // Load the stored value when the popup is opened
  chrome.storage.sync.get(['dailyTotal'], function(data) {
      dailyAmountInput.value = data.dailyTotal || '';
  });

  dailyAmountInput.addEventListener('blur', function() {
      // Store the value when the input loses focus
      chrome.storage.sync.set({dailyTotal: dailyAmountInput.value}, function() {
          console.log('Daily total amount set to: ' + dailyAmountInput.value);
      });
  });
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


// Update BTC stats when the popup is loaded
document.addEventListener('DOMContentLoaded', async function() {
  const trades = await getTodaysTrades();
  const dailyAmount = await chrome.storage.sync.get(['dailyTotal'])
  daylyAmount()
  updateBtcStats(trades, dailyAmount.dailyTotal || 0)
  await updateBalances()
  showTodaysTrades(trades)
  // await fetchAndDisplayOrders()
});

updateLastPrice();

// add interval
setInterval(async () => {
  updateLastPrice();
}, 15000);
