import db from '../db/index';

/* ── CRUD ── */

export async function addSubscription(data) {
  try {
    return db.subscriptions.add({ ...data, is_active: true });

  } catch (e) {
    console.error('[subscriptions.addSubscription]', e);
    throw e;
  }
}

export async function getSubscriptions() {
  try {
    return db.subscriptions.toArray().then(s => s.filter(x => x.is_active !== false));

  } catch (e) {
    console.error('[subscriptions.getSubscriptions]', e);
    return [];
  }
}

export async function updateSubscription(id, data) {
  try {
    /* G6 — Track price changes in price_history array */
    if (data.amount !== undefined) {
      const existing = await db.subscriptions.get(id);
      if (existing && existing.amount !== data.amount) {
        const history = existing.price_history || [];
        history.push({
          amount: existing.amount,
          currency: existing.currency || 'KZT',
          changed_at: new Date().toISOString().slice(0, 10),
        });
        data.price_history = history;
      }
    }
    return db.subscriptions.update(id, data);

  } catch (e) {
    console.error('[subscriptions.updateSubscription]', e);
    throw e;
  }
}

export async function deleteSubscription(id) {
  try {
    return db.subscriptions.update(id, { is_active: false });

  } catch (e) {
    console.error('[subscriptions.deleteSubscription]', e);
    throw e;
  }
}

/* ── Totals ── */

export async function getMonthlyTotal() {
  try {
    const subs = await getSubscriptions();
    return subs.reduce((sum, s) => {
      if (s.frequency === 'yearly') return sum + (s.amount || 0) / 12;
      return sum + (s.amount || 0);
    }, 0);

  } catch (e) {
    console.error('[subscriptions.getMonthlyTotal]', e);
    return null;
  }
}

export async function getYearlyTotal() {
  try {
    const subs = await getSubscriptions();
    return subs.reduce((sum, s) => {
      if (s.frequency === 'yearly') return sum + (s.amount || 0);
      return sum + (s.amount || 0) * 12;
    }, 0);

  } catch (e) {
    console.error('[subscriptions.getYearlyTotal]', e);
    return null;
  }
}

/* ── Upcoming ── */

export async function getUpcoming(days = 30) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().slice(0, 10);

    const subs = await getSubscriptions();
    return subs
      .filter(s => s.next_payment >= today && s.next_payment <= futureStr)
      .sort((a, b) => a.next_payment.localeCompare(b.next_payment));

  } catch (e) {
    console.error('[subscriptions.getUpcoming]', e);
    return null;
  }
}

/* ── By category ── */

export async function getByCategory() {
  try {
    const subs = await getSubscriptions();
    const groups = {};
    subs.forEach(s => {
      const cat = s.category_name_snapshot || 'Другое';
      if (!groups[cat]) groups[cat] = { name: cat, items: [], total: 0 };
      groups[cat].items.push(s);
      groups[cat].total += s.frequency === 'yearly' ? (s.amount || 0) / 12 : (s.amount || 0);
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);

  } catch (e) {
    console.error('[subscriptions.getByCategory]', e);
    return null;
  }
}

/* ── G2 — Due reminders (N days before) ── */

export async function getDueReminders() {
  try {
    const subs = await getSubscriptions();
    const today = new Date();
    return subs
      .filter(s => {
        if (!s.remind_days_before || !s.next_payment) return false;
        const payDate = new Date(s.next_payment);
        const diffDays = Math.ceil((payDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= s.remind_days_before;
      })
      .map(s => {
        const payDate = new Date(s.next_payment);
        const diffDays = Math.ceil((payDate - today) / (1000 * 60 * 60 * 24));
        return { ...s, daysUntilPayment: diffDays };
      });

  } catch (e) {
    console.error('[subscriptions.getDueReminders]', e);
    return [];
  }
}

/* ── G7 — Cancel / get cancelled ── */

export async function cancelSubscription(id) {
  try {
    return db.subscriptions.update(id, {
      cancelled_at: new Date().toISOString(),
      is_active: false,
    });

  } catch (e) {
    console.error('[subscriptions.cancelSubscription]', e);
    throw e;
  }
}

export async function getCancelledSubscriptions() {
  try {
    const all = await db.subscriptions.toArray();
    return all.filter(x => x.is_active === false && x.cancelled_at);

  } catch (e) {
    console.error('[subscriptions.getCancelledSubscriptions]', e);
    return [];
  }
}
