import db from '../db/index';

/**
 * E3: Price Alerts — целевые цены для watchlist-тикеров.
 * direction: 'above' | 'below'
 */

export async function addAlert(ticker, targetPrice, direction = 'above') {
  try {
    return db.price_alerts.add({
      ticker,
      target_price: targetPrice,
      direction,
      is_triggered: false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[priceAlerts.addAlert]', e);
    throw e;
  }
}

export async function getAlerts(ticker) {
  try {
    if (ticker) {
      return db.price_alerts.where('ticker').equals(ticker).toArray();
    }
    return db.price_alerts.toArray();
  } catch (e) {
    console.error('[priceAlerts.getAlerts]', e);
    return [];
  }
}

export async function getActiveAlerts() {
  try {
    return db.price_alerts.filter(a => !a.is_triggered).toArray();
  } catch (e) {
    console.error('[priceAlerts.getActiveAlerts]', e);
    return [];
  }
}

export async function deleteAlert(id) {
  try {
    return db.price_alerts.delete(id);
  } catch (e) {
    console.error('[priceAlerts.deleteAlert]', e);
    throw e;
  }
}

export async function checkAlerts(quotes) {
  try {
    const active = await getActiveAlerts();
    const triggered = [];

    for (const alert of active) {
      const quote = quotes.find(q => q.ticker === alert.ticker);
      if (!quote?.price) continue;

      const hit = alert.direction === 'above'
        ? quote.price >= alert.target_price
        : quote.price <= alert.target_price;

      if (hit) {
        await db.price_alerts.update(alert.id, {
          is_triggered: true,
          triggered_at: new Date().toISOString(),
          triggered_price: quote.price,
        });
        triggered.push({
          ...alert,
          current_price: quote.price,
        });
      }
    }

    return triggered;
  } catch (e) {
    console.error('[priceAlerts.checkAlerts]', e);
    return [];
  }
}
