importScripts('lib.js');

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
  chrome.storage.session.set({ lastPrice: lastPrice });
  const priceInK = price / 1000;
  chrome.action.setBadgeText({ text: priceInK.toFixed(1) }); // Display the price
}

let dailyTarget = 1000; // $1000 worth of BTC
let buyingHours = [14, 16, 18, 20, 22, 24]; // UTC hours

// This function checks and triggers the buy operation.
async function checkAndTriggerBuy() {
    const currentHour = new Date().getUTCHours();

    // Check if the current hour is one of the buying hours
    if (buyingHours.includes(currentHour)) {
        const trades = await getTodaysTrades();
        const totalBoughtToday = trades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
        const remainingAmount = dailyTarget - totalBoughtToday;

        const remainingBuyOperations = buyingHours.filter(hour => hour > currentHour).length;

        if (remainingBuyOperations > 0) {
            const buyAmount = remainingAmount / remainingBuyOperations;
            executeBuyOperation(buyAmount);
        }

    }
}

function executeBuyOperation(amount) {
}


fetchPrice(updateBadge);

setInterval(() => {
  fetchPrice(updateBadge);
  checkAndTriggerBuy();
}, 15000);
