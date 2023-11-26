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
async function checkAndTriggerBuy(trades, curPrice) {
    const balances = await getBalances()
    /*
    if onOff setting is off, return
    get tranche amount and buy amount from local storage
    if tranche amount is 0, return
    if tranche amount is 0, return
    if tranche amount is less than min amount, return
    set buy amount to min of tranche amount and available balance
    if there is no last trade, buy immediately
    otherwise, check if last trade is before the next buy time
    if yes, buy immediately
   */
    // generate code from description above
    const { onOff } = await chrome.storage.local.get(['onOff'])
    if (!onOff) {
        console.log('onOff is off. No buy operation.')
        return
    }

    if (curPrice <= 0) {
        console.log('curPrice ', curPrice, ' is <= 0. No buy operation')
        return
    }

    const { trancheAmount, trancheCycle } = await chrome.storage.local.get([
        'trancheAmount',
        'trancheCycle',
    ])
    if (trancheAmount === 0) {
        console.log('trancheAmount is 0. No buy operation.')
        return
    }
    if (trancheCycle === 0) {
        console.log('trancheCycle is 0. No buy operation.')
        return
    }
    if (trancheAmount < 1) {
        console.log(
            'trancheAmount is less than min amount of 1. No buy operation.'
        )
        return
    }
    const buyAmountUSDT = Math.min(trancheAmount, balances.ust)
    const buyAmountBTC = buyAmountUSDT / curPrice
    console.log(
        'buyAmountUSDT: ',
        buyAmountUSDT,
        ' buyAmountBTC: ',
        buyAmountBTC
    )
    if (buyAmountBTC < 0.00001) {
        console.log(
            'buyAmount is less than min amount of 0.00001. No buy operation.'
        )
        return
    }

    const lastTrade = trades[0]
    if (!lastTrade) {
        console.log('No last trade. Buy immediately.')
        executeTrade(buyAmountBTC)
        return
    }
    const nextBuy = nextBuyTime(lastTrade, trancheCycle)
    const now = Date.now()
    if (now >= nextBuy) {
        console.log('Next buy time is reached. Buy immediately ', buyAmountBTC)
        executeTrade(buyAmountBTC)
        return
    }
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
        checkAndTriggerBuy(trades, curPrice)
    }
})
