let usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
})

async function updateBalances(api) {
    const balances = await api.getBalances()
    document.getElementById('btc-balance').innerText = balances.btc.toFixed(4)
    document.getElementById('ust-balance').innerText = usdFormatter.format(balances.ust.toFixed(0))
}

function showTodaysTrades(trades) {
    const tradesTable = document.getElementById('today-trades')
    // Clear existing rows
    while (tradesTable.firstChild) {
        tradesTable.removeChild(tradesTable.firstChild)
    }
    const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    trades.forEach((trade) => {
        const row = tradesTable.insertRow()
        row.insertCell().innerText = new Date(trade.timestamp).toLocaleTimeString('en-US', options) // Time
        row.insertCell().innerText = usdFormatter.format(trade.price.toFixed(0)) // Price
        row.insertCell().innerText = trade.amount.toFixed(4) // Amount
        row.insertCell().innerText = usdFormatter.format(trade.amount * trade.price) // Total
    })
}

function updateBtcStats(monthTrades) {
    const todayTrades = getTodayTrades(monthTrades)
    const weekTrades = getThisWeekTrades(monthTrades)

    function updateStats(trades, prefix) {
        let totalAmount = 0
        let totalPrice = 0

        // log
        console.log('Trades', trades)

        trades.forEach((trade) => {
            if (trade.amount > 0) {
                // Buys only
                totalAmount += trade.amount
                totalPrice += trade.amount * trade.price
            }
        })

        const avgPrice = totalAmount > 0.0 ? totalPrice / totalAmount : 0.0

        document.getElementById(prefix + '-avg-price').innerText = usdFormatter.format(avgPrice.toFixed(2))
        document.getElementById(prefix + '-btc-bought').innerText = totalAmount.toFixed(4)
        document.getElementById(prefix + '-usdt-spent').innerText = usdFormatter.format(totalPrice.toFixed(0))
        return totalPrice
    }

    const boughtTodayInUSDT = updateStats(todayTrades, 'today')
    updateStats(weekTrades, 'week')
    updateStats(monthTrades, 'month')

    console.log('boughtTodayInUSDT: ', boughtTodayInUSDT)
}

async function updateLastPrice() {
    const lastPrice = await fetchPrice()
    console.log('lastPrice: ', lastPrice)
    let price = lastPrice || 0
    document.getElementById('last-price').innerText = usdFormatter.format(price)
}

async function updateNextBuy(onOff, trancheCycle, trades) {
    let nextBuyText = 'off'
    if (onOff) {
        const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
        const alarm = await chrome.alarms.get('update-alarm')
        const nextBuyTimestamp = Math.max(alarm.scheduledTime, nextBuyTime(trades[0], trancheCycle))
        nextBuyText = new Date(nextBuyTimestamp).toLocaleTimeString('en-US', options)
    }

    document.getElementById('next-buy-time').innerText = nextBuyText
}

function updateInvestmentConfigString(trancheAmount, trancheCycle) {
    console.log('trancheAmount: ', trancheAmount, 'trancheCycle: ', trancheCycle)
    const trancheAmountConfig = parseFloat(trancheAmount || 0)
    const trancheCycleConfig = parseFloat(trancheCycle || 0)
    document.getElementById('tranche-amount-config').innerText = trancheAmountConfig.toFixed(0)
    document.getElementById('tranche-cycle-config').innerText = trancheCycleConfig.toFixed(0)
}

async function updateUI() {
    const settings = await getSettings()
    if (settings.apiKey && settings.apiSecret) {
        const api = new BitfinexApi(apiKey, apiSecret)
        const trades = await getMonthTrades(api)
        updateBtcStats(trades)
        await updateBalances(api)
        await updateNextBuy(settings.onOff, settings.trancheCycle, trades)
        updateInvestmentConfigString(settings.trancheAmount, settings.trancheCycle)
        showTodaysTrades(getTodayTrades(trades))
    }
    await updateLastPrice()
}

async function setupUI() {
    // On/Off button
    const { onOff } = await getSettings()
    const onOffSwitch = document.getElementById('onOffSwitch')
    onOffSwitch.checked = onOff || false
    onOffSwitch.addEventListener('click', async () => {
        const onOff = onOffSwitch.checked
        await chrome.storage.local.set({ onOff })
        updateUI()
    })

    // Toggle the settings div visibility
    document.getElementById('settingsBtn').addEventListener('click', async function () {
        const settingsDiv = document.getElementById('settingsModal')
        if (settingsDiv.style.display === 'none') {
            const { apiKey, apiSecret, trancheAmount, trancheCycle } = await getSettings()
            document.getElementById('apiKeyInput').value = apiKey
            document.getElementById('apiSecretInput').value = apiSecret
            document.getElementById('trancheAmount').value = trancheAmount || 10
            document.getElementById('trancheCycle').value = trancheCycle || 6
            settingsDiv.style.display = 'block'
        } else {
            settingsDiv.style.display = 'none'
        }
    })

    // Save settings to chrome.storage.local
    document.getElementById('saveSettingsBtn').addEventListener('click', async function () {
        const settingsDiv = document.getElementById('settingsModal')
        const apiKey = document.getElementById('apiKeyInput').value
        const apiSecret = document.getElementById('apiSecretInput').value
        const trancheAmount = parseFloat(document.getElementById('trancheAmount').value)
        const trancheCycle = parseFloat(document.getElementById('trancheCycle').value)
        await chrome.storage.local.set({
            apiKey,
            apiSecret,
            trancheAmount,
            trancheCycle,
        })
        settingsDiv.style.display = 'none'
        updateUI()
    })

    // Clear settings from chrome.storage.local
    document.getElementById('clearSettingsBtn').addEventListener('click', async function () {
        const settingsDiv = document.getElementById('settingsModal')
        await chrome.storage.local.remove(['apiKey', 'apiSecret', 'trancheAmount', 'trancheCycle', 'onOff'])
        document.getElementById('apiKeyInput').value = ''
        document.getElementById('apiSecretInput').value = ''
        document.getElementById('trancheAmount').value = 10
        document.getElementById('trancheCycle').value = 6
        settingsDiv.style.display = 'none'
        updateUI()
    })

    // Close the settings div when the user clicks outside of it
    document.getElementById('closeSettingsBtn').addEventListener('click', async function () {
        const settingsDiv = document.getElementById('settingsModal')
        settingsDiv.style.display = 'none'
    })

    // add interval
    setInterval(updateUI, 15000)
    updateUI()
}

setupUI()
