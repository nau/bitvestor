async function generateHMAC(message, secret) {
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const keyData = encoder.encode(secret)

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-384' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, data)
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

// Fetch the current BTC/USDT price
async function fetchPrice() {
    const endpoint = 'https://api-pub.bitfinex.com/v2/ticker/tBTCUST'
    return fetch(endpoint, { method: 'GET', mode: 'no-cors' })
        .then((response) => {
            return response.json()
        })
        .then((data) => data[2])
        .catch((error) => {
            console.error(error)
            return 0
        })
}

async function getTradesForPeriod(start, end) {
    const { apiKey, apiSecret } = await chrome.storage.local.get([
        'apiKey',
        'apiSecret',
    ])

    const body = {
        start: start,
        end: end,
        limit: 2500,
    }

    const apiUrl = `https://api.bitfinex.com/v2/auth/r/trades/tBTCUST/hist`
    const nonce = Date.now().toString()
    const signature = `/api/v2/auth/r/trades/tBTCUST/hist${nonce}${JSON.stringify(
        body
    )}`
    const sigHash = await generateHMAC(signature, apiSecret)

    const response = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'bfx-nonce': nonce,
            'bfx-apikey': apiKey,
            'bfx-signature': sigHash,
            'Content-Type': 'application/json',
        },
    })

    const trades = await response.json()
    return trades.map((trade) => {
        return {
            id: trade[0],
            symbol: trade[1],
            timestamp: trade[2],
            amount: trade[4],
            price: trade[5],
        }
    })
}

async function getMonthTrades() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    )
    console.log(
        'getMonthTrades startOfMonth',
        startOfMonth,
        'endOfMonth',
        endOfMonth
    )
    return getTradesForPeriod(startOfMonth.getTime(), endOfMonth.getTime())
}

function getTodayTrades(trades) {
    const now = new Date()
    const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    )
    const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
    )
    return trades.filter(
        (trade) =>
            trade.timestamp >= startOfDay.getTime() &&
            trade.timestamp <= endOfDay.getTime()
    )
}

function getThisWeekTrades(trades) {
    const now = new Date()
    const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay()
    )
    const endOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + (6 - now.getDay()),
        23,
        59,
        59,
        999
    )
    return trades.filter(
        (trade) =>
            trade.timestamp >= startOfWeek.getTime() &&
            trade.timestamp <= endOfWeek.getTime()
    )
}

async function executeTrade(amount) {
    const { apiKey, apiSecret } = await chrome.storage.local.get([
        'apiKey',
        'apiSecret',
    ])

    const apiUrl = 'https://api.bitfinex.com/v2/auth/w/order/submit'
    const nonce = Date.now().toString()

    // Construct the order details
    const body = {
        symbol: 'tBTCUST', // trading pair symbol
        cid: Date.now(), // client order ID, can be any unique number
        type: 'EXCHANGE MARKET',
        amount: amount.toFixed(8), // the amount in BTC to buy
        price: '1', // For market orders, this can be any number but is ignored by the platform
        side: 'buy',
    }

    const rawBody = JSON.stringify(body)
    const signature = `/api/v2/auth/w/order/submit${nonce}${rawBody}`
    const sigHash = await generateHMAC(signature, apiSecret)

    const response = await fetch(apiUrl, {
        method: 'POST',
        body: rawBody,
        headers: {
            'bfx-nonce': nonce,
            'bfx-apikey': apiKey,
            'bfx-signature': sigHash,
            'Content-Type': 'application/json',
        },
    })

    const data = await response.json()

    console.log('Order submission response:', data)

    if (data[6] === 'SUCCESS') {
        return true
    }

    console.log('Order submission failed!: ' + JSON.stringify(data))
    return false
}

async function getBalances() {
    const { apiKey, apiSecret } = await chrome.storage.local.get([
        'apiKey',
        'apiSecret',
    ])

    const apiUrl = `https://api.bitfinex.com/v2/auth/r/wallets`
    const nonce = Date.now().toString()
    const body = {}
    const signature = `/api/v2/auth/r/wallets${nonce}${JSON.stringify(body)}`
    const sigHash = await generateHMAC(signature, apiSecret)

    const response = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'bfx-nonce': nonce,
            'bfx-apikey': apiKey,
            'bfx-signature': sigHash,
            'Content-Type': 'application/json',
        },
    })

    const wallets = await response.json()
    // log
    console.log('Wallets', wallets)

    const btcWallet = wallets.find((wallet) => wallet[1] === 'BTC')
    const ustWallet = wallets.find((wallet) => wallet[1] === 'UST')

    return {
        btc: btcWallet ? btcWallet[2] : 0,
        ust: ustWallet ? ustWallet[2] : 0,
    }
}

function nextBuyTime(lastTrade, trancheCycle) {
    if (!lastTrade) {
        return Date.now()
    }
    return lastTrade.timestamp + trancheCycle * 60 * 60 * 1000
}
