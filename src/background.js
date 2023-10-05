var lastPrice = 0;
// Fetch the current BTC/USDT price
function fetchPrice(callback) {
  const endpoint = 'https://api-pub.bitfinex.com/v2/ticker/tBTCUST';
  fetch(endpoint, { method: 'GET', mode: 'no-cors' })
      .then(response => {
        return response.json();
      })
      .then(data => {
        callback(data[2]);// ASK price
      })

}

// Update the extension icon with the current price
function updateBadge(price) {
  // green or red color
  if (lastPrice < price) {
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#00FF00' });
  }
  lastPrice = price;
  chrome.action.setBadgeText({ text: price.toFixed(0) }); // Display the price
}

// Periodically update the badge text with the current BTC/USDT price
const PRICE_UPDATE_INTERVAL =  15000;

setInterval(() => {
  fetchPrice(updateBadge);
}, PRICE_UPDATE_INTERVAL);
