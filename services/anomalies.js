/**
 * Q2.3: Аномалии — обнаружение необычных паттернов.
 * Сравнивает текущие метрики со средними за последние 30 дней.
 * Аномалия = отклонение > 2 стандартных отклонения.
 */
import db from '../db/index';

export async function detectAnomalies() {
  const results = [];
  const today = new Date().toISOString().slice(0, 10);

  try {
    // === Расходы: необычно большой день ===
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const start = thirtyDaysAgo.toISOString().slice(0, 10);

    const expenses = await db.expenses.where('date').between(start, today, true, true).toArray();
    const dailyTotals = {};
    for (const e of expenses) {
      dailyTotals[e.date] = (dailyTotals[e.date] || 0) + (e.amount_base || e.amount || 0);
    }
    const dailyValues = Object.values(dailyTotals);

    if (dailyValues.length >= 7) {
      const todayTotal = dailyTotals[today] || 0;
      const { mean, std } = stats(dailyValues);

      if (todayTotal > mean + 2 * std && todayTotal > 0) {
        results.push({
          type: 'high_spending',
          icon: '💸',
          severity: 'warning',
          title: 'Необычно высокие траты',
          message: `Сегодня ${Math.round(todayTotal)}₸ — обычно ~${Math.round(mean)}₸/день`,
          deviation: std > 0 ? (todayTotal - mean) / std : 0,
        });
      }
    }

    // === Расходы по категориям: аномально большая трата ===
    const todayExpenses = expenses.filter(e => e.date === today);
    for (const expense of todayExpenses) {
      const catExpenses = expenses.filter(e =>
        e.category_path_snapshot === expense.category_path_snapshot && e.date !== today
      );
      const amounts = catExpenses.map(e => e.amount_base || e.amount || 0);
      if (amounts.length >= 5) {
        const { mean, std } = stats(amounts);
        const amount = expense.amount_base || expense.amount || 0;
        if (amount > mean + 2.5 * std && amount > mean * 3) {
          results.push({
            type: 'category_anomaly',
            icon: '📊',
            severity: 'info',
            title: `Крупная трата: ${expense.category_path_snapshot}`,
            message: `${Math.round(amount)}₸ — обычно ~${Math.round(mean)}₸`,
            deviation: std > 0 ? (amount - mean) / std : 0,
          });
        }
      }
    }

    // === Сон: необычно мало/много ===
    const sleepLogs = await db.sleep_log.where('date').between(start, today, true, true).toArray();
    if (sleepLogs.length >= 7) {
      const hours = sleepLogs.map(s => s.duration_hours || 0);
      const todaySleep = sleepLogs.find(s => s.date === today);
      if (todaySleep) {
        const { mean, std } = stats(hours);
        const h = todaySleep.duration_hours || 0;
        if (Math.abs(h - mean) > 2 * std) {
          results.push({
            type: h < mean ? 'low_sleep' : 'high_sleep',
            icon: '😴',
            severity: h < mean ? 'warning' : 'info',
            title: h < mean ? 'Очень мало сна' : 'Необычно много сна',
            message: `${h}ч — обычно ~${mean.toFixed(1)}ч`,
            deviation: std > 0 ? Math.abs(h - mean) / std : 0,
          });
        }
      }
    }

    // === Вес: резкий скачок ===
    const weights = await db.body_weight.orderBy('date').reverse().limit(10).toArray();
    if (weights.length >= 3) {
      const vals = weights.map(w => w.weight);
      const { mean, std } = stats(vals.slice(1)); // кроме последнего
      const latest = vals[0];
      if (std > 0 && Math.abs(latest - mean) > 2 * std) {
        results.push({
          type: latest > mean ? 'weight_spike' : 'weight_drop',
          icon: '⚖️',
          severity: 'info',
          title: latest > mean ? 'Резкий рост веса' : 'Резкое падение веса',
          message: `${latest} кг — обычно ~${mean.toFixed(1)} кг`,
          deviation: (latest - mean) / std,
        });
      }
    }

    // === Калории: аномально высокий день ===
    const foodLogs = await db.food_log.where('date').between(start, today, true, true).toArray();
    const dailyCals = {};
    for (const f of foodLogs) {
      const cals = (f.items || []).reduce((s, i) => s + (i.calories || 0), 0);
      dailyCals[f.date] = (dailyCals[f.date] || 0) + cals;
    }
    const calValues = Object.values(dailyCals);
    if (calValues.length >= 7) {
      const todayCals = dailyCals[today] || 0;
      const { mean, std } = stats(calValues);
      if (todayCals > mean + 2 * std && todayCals > 0) {
        results.push({
          type: 'high_calories',
          icon: '🍔',
          severity: 'info',
          title: 'Калорийный день',
          message: `${Math.round(todayCals)} ккал — обычно ~${Math.round(mean)} ккал`,
          deviation: std > 0 ? (todayCals - mean) / std : 0,
        });
      }
    }

  } catch (e) {
    console.error('[anomalies]', e);
  }

  return results.sort((a, b) => (b.deviation || 0) - (a.deviation || 0));
}

function stats(values) {
  const filtered = values.filter(v => v != null && !isNaN(v));
  if (filtered.length === 0) return { mean: 0, std: 0 };
  const mean = filtered.reduce((s, v) => s + v, 0) / filtered.length;
  const variance = filtered.reduce((s, v) => s + (v - mean) ** 2, 0) / filtered.length;
  return { mean, std: Math.sqrt(variance) };
}
