importScripts('lib.js')

// Update the extension icon with the current price
function updateBadge(price, trades) {
    function getWeightedAvgPrice(trades) {
        let totalAmount = 0
        let totalPrice = 0

        trades.forEach((trade) => {
            if (trade.amount > 0) {
                // Buys only
                totalAmount += trade.amount
                totalPrice += trade.amount * trade.price
            }
        })

        const avgPrice = totalAmount > 0.0 ? totalPrice / totalAmount : 0.0
        return avgPrice
    }

    const wavgPrice = getWeightedAvgPrice(trades)

    // green or red color
    if (price < wavgPrice) {
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' })
    } else {
        chrome.action.setBadgeBackgroundColor({ color: '#00FF00' })
    }
    const priceInK = price / 1000
    chrome.action.setBadgeText({ text: priceInK.toFixed(1) }) // Display the price
}

// This function checks and triggers the buy operation.
async function checkAndTriggerBuy(lastPrice, trades) {
    const dailyTargetUSDT =
        (await chrome.storage.sync.get(['dailyTotal'])).dailyTotal || 0
    const currentHour = new Date().getHours()
    const balances = await getBalances()
    const totalBoughtTodayInUSDT = trades.reduce(
        (sum, trade) => sum + trade.amount * trade.price,
        0
    )
    const remainingTargetAmountUSDT = dailyTargetUSDT - totalBoughtTodayInUSDT

    const haveBoughtAtThisHour = trades.some(
        (trade) => new Date(trade.timestamp).getHours() === currentHour
    )
    const remainingBuyOperations =
        24 - currentHour - (haveBoughtAtThisHour ? 1 : 0)
    const buyTranchAmountUSDT =
        remainingTargetAmountUSDT / remainingBuyOperations
    const buyAmountUSDT = Math.min(buyTranchAmountUSDT, balances.ust)
    const buyAmounBTC = buyAmountUSDT / lastPrice
    console.log(
        'currentHour ',
        currentHour,
        ' haveBouthAtThisHour ',
        haveBoughtAtThisHour,
        ' remainingBuyOperations ',
        remainingBuyOperations,
        ' buyAmountUSDT ',
        buyAmountUSDT,
        ' buyAmounBTC ',
        buyAmounBTC
    )

    if (haveBoughtAtThisHour) {
        console.log(
            'Already bought at this hour. No more buy operations today.'
        )
        return
    }

    if (remainingBuyOperations <= 0) {
        console.log('Daily target reached. No more buy operations today.')
        return
    }

    if (buyAmounBTC < 0.00006) {
        console.log(
            'Minimum buy amount is 0.00006 BTC, but need to buy ',
            buyAmounBTC.toFixed(6),
            ' BTC to reach the daily target.'
        )
        return
    }

    executeTrade(buyAmounBTC)
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    console.log('onInstalled...' + reason)

    await chrome.alarms.create('update-alarm', {
        delayInMinutes: 0,
        periodInMinutes: 5,
    })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'update-alarm') {
        const curPrice = await fetchPrice()
        const monthTrades = await getMonthTrades()
        const trades = getTodayTrades(monthTrades)
        updateBadge(curPrice, trades)
        checkAndTriggerBuy(curPrice, trades)
    }
})
