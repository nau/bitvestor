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
async function checkAndTriggerBuy(settings, api, trades, curPrice) {
    const balances = await api.getBalances()
    if (!settings.onOff) {
        console.log('onOff is off. No buy operation.')
        return
    }

    if (curPrice <= 0) {
        console.log('curPrice ', curPrice, ' is <= 0. No buy operation')
        return
    }

    if (settings.trancheAmount < 1) {
        console.log('trancheAmount < 0. No buy operation.')
        return
    }
    if (settings.trancheCycle <= 0) {
        console.log('trancheCycle <= 0. No buy operation.')
        return
    }
    const buyAmountUSDT = Math.min(settings.trancheAmount, balances.ust)
    const buyAmountBTC = buyAmountUSDT / curPrice
    console.log('buyAmountUSDT: ', buyAmountUSDT, ' buyAmountBTC: ', buyAmountBTC)
    if (buyAmountBTC < 0.00001) {
        console.log('buyAmount is less than min amount of 0.00001. No buy operation.')
        return
    }

    const lastTrade = trades[0]
    if (lastTrade) {
        const nextBuy = nextBuyTime(lastTrade, settings.trancheCycle)
        const now = Date.now()
        if (now >= nextBuy) {
            console.log('Next buy time is reached. Buy immediately ', buyAmountBTC)
            api.executeTrade(buyAmountBTC)
        }
    } else {
        console.log('No last trade. Buy immediately.')
        api.executeTrade(buyAmountBTC)
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
        const settings = await getSettings()
        if (settings.apiKey && settings.apiSecret) {
            const api = new BitfinexApi(settings.apiKey, settings.apiSecret)
            const monthTrades = await getMonthTrades(api)
            const trades = getTodayTrades(monthTrades)
            updateBadge(curPrice, trades)
            checkAndTriggerBuy(settings, api, trades, curPrice)
        } else {
            updateBadge(curPrice, [])
        }
    }
})
