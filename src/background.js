importScripts('lib.js');

var lastPrice = 0;

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

// This function checks and triggers the buy operation.
async function checkAndTriggerBuy() {
    const dailyTargetUSDT = (await chrome.storage.sync.get(['dailyTotal'])).dailyTotal || 0;
    const currentHour = new Date().getHours();
    const monthTrades = await getMonthTrades();
    const trades = getTodayTrades(monthTrades);
    const balances = await getBalances();
    const totalBoughtTodayInUSDT = trades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
    const remainingTargetAmountUSDT = dailyTargetUSDT - totalBoughtTodayInUSDT;

    const haveBouthAtThisHour = trades.some(trade => new Date(trade.timestamp).getHours() === currentHour);
    const remainingBuyOperations = 24 - currentHour - (haveBouthAtThisHour ? 1 : 0);
    const buyTranchAmountUSDT = remainingTargetAmountUSDT / remainingBuyOperations;
    const buyAmountUSDT = Math.min(buyTranchAmountUSDT, balances.ust);
    const buyAmounBTC = buyAmountUSDT / lastPrice;
    console.log('currentHour ', currentHour, ' haveBouthAtThisHour ', haveBouthAtThisHour, ' remainingBuyOperations ', remainingBuyOperations, ' buyAmountUSDT ', buyAmountUSDT, ' buyAmounBTC ', buyAmounBTC);

    if (haveBouthAtThisHour) {
      console.log('Already bought at this hour. No more buy operations today.');
      return
    }

    if (remainingBuyOperations <= 0) {
      console.log('Daily target reached. No more buy operations today.');
      return
    }

    if (buyAmounBTC < 0.00006) {
      console.log('Minimum buy amount is 0.00006 BTC, but need to buy ', buyAmounBTC.toFixed(6), ' BTC to reach the daily target.');
      return
    }

    executeTrade(buyAmounBTC);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  console.log('onInstalled...' + reason);

  await chrome.alarms.create('update-alarm', {
    delayInMinutes: 0,
    periodInMinutes: 5
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'update-alarm') {
    fetchPrice().then(updateBadge);
    checkAndTriggerBuy();
  }
});
