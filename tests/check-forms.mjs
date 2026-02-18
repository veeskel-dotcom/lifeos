/**
 * CRUD Forms Test v2 — правильные селекторы, таблицы и обязательные поля.
 * Run: node tests/check-forms.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5199';
const DB_NAME = 'LifeOS';

const FORMS = [
  {
    name: 'expense-form',
    screen: 'expense-form',
    table: 'expenses',
    fills: async (page) => {
      // Сумма — input[inputmode="decimal"]
      const amount = page.locator('input[inputmode="decimal"]').first();
      if (await amount.count()) await amount.fill('500');
      // Описание — placeholder "Кофе в старбаксе"
      const desc = page.locator('input[placeholder*="Кофе"]').first();
      if (await desc.count()) await desc.fill('Тестовый расход');
      // Категория — кликаем первый чип категории (CategoryPicker)
      // CategoryPicker рендерит grid кнопок с иконками
      await page.waitForTimeout(300);
      const cats = page.locator('button:visible >> text=/🍔|🛒|🏠|🚗|💊|🎮|📱|👕|✈️|☕|🎁|📚/');
      if (await cats.count() > 0) await cats.first().click().catch(() => {});
    },
    // Кнопка: "💚 Сохранить" — ищем по подстроке без эмодзи
    submit: async (page) => {
      const btn = page.locator('button:visible').filter({ hasText: 'Сохранить' }).first();
      if (await btn.count()) { await btn.click(); return true; }
      return false;
    },
  },
  {
    name: 'income-form',
    screen: 'income-form',
    table: 'incomes',
    fills: async (page) => {
      const amount = page.locator('input[inputmode="decimal"]').first();
      if (await amount.count()) await amount.fill('50000');
      const desc = page.locator('input[placeholder*="Зарплата"]').first();
      if (await desc.count()) await desc.fill('Зарплата тест');
      // Категория дохода
      const cats = page.locator('button:visible >> text=/💰|💼|📈|🎁|💵|🏦/');
      if (await cats.count() > 0) await cats.first().click().catch(() => {});
    },
    submit: async (page) => {
      const btn = page.locator('button:visible').filter({ hasText: 'Сохранить' }).first();
      if (await btn.count()) { await btn.click(); return true; }
      return false;
    },
  },
  {
    name: 'task-form',
    screen: 'task-form',
    table: 'tasks',
    fills: async (page) => {
      const title = page.locator('input[placeholder*="Название задачи"]').first();
      if (await title.count()) await title.fill('Тестовая задача');
    },
    submit: async (page) => {
      // "Создать задачу" или "Готово" в хедере
      const btn = page.locator('button:visible').filter({ hasText: 'Создать задачу' }).first();
      if (await btn.count()) { await btn.click(); return true; }
      const done = page.locator('button:visible, span:visible').filter({ hasText: 'Готово' }).first();
      if (await done.count()) { await done.click(); return true; }
      return false;
    },
  },
  {
    name: 'routine-form',
    screen: 'routine-form',
    table: 'routines',
    fills: async (page) => {
      const name = page.locator('input[placeholder*="Название рутины"], input[placeholder*="азван"]').first();
      if (await name.count()) await name.fill('Тестовая рутина');
    },
    submit: async (page) => {
      // Только "Готово" в NavHeader — это span или div в хедере
      const done = page.locator('div:visible, span:visible, button:visible').filter({ hasText: /^Готово$/ }).first();
      if (await done.count()) { await done.click(); return true; }
      return false;
    },
  },
  {
    name: 'note-editor',
    screen: 'note-editor',
    table: 'notes',
    fills: async (page) => {
      const title = page.locator('input[placeholder*="Заголовок"]').first();
      if (await title.count()) await title.fill('Тестовая заметка');
      const content = page.locator('textarea[placeholder*="Текст"]').first();
      if (await content.count()) await content.fill('Содержимое тестовой заметки');
    },
    submit: async (page) => {
      // "Готово" в хедере (+ автосохранение)
      const done = page.locator('div:visible, span:visible, button:visible').filter({ hasText: /^Готово$/ }).first();
      if (await done.count()) { await done.click(); return true; }
      // Если нет кнопки — автосохранение через 2 сек
      await page.waitForTimeout(2000);
      return true;
    },
  },
  {
    name: 'goal-form',
    screen: 'goal-form',
    table: 'goals',
    fills: async (page) => {
      // Шаг 1: выбрать тип цели — кликаем "Накопить"
      const typeBtn = page.locator('button:visible, div[style*="cursor"]').filter({ hasText: 'Накопить' }).first();
      if (await typeBtn.count()) {
        await typeBtn.click();
        await page.waitForTimeout(800);
      }
      // Шаг 2: ввести целевое значение
      const target = page.locator('input[inputmode="decimal"], input[type="number"]').first();
      if (await target.count()) await target.fill('100000');
    },
    submit: async (page) => {
      const btn = page.locator('button:visible').filter({ hasText: 'Создать цель' }).first();
      if (await btn.count()) { await btn.click(); return true; }
      return false;
    },
  },
  {
    name: 'sleep-form',
    screen: 'sleep-form',
    table: 'sleep_log',
    fills: async (page) => {
      // Время уже заполнено дефолтами (23:00, 07:00)
      // Качество — range slider, дефолт 7 — ОК
      // Можно просто сохранить как есть
    },
    submit: async (page) => {
      const done = page.locator('div:visible, span:visible, button:visible').filter({ hasText: /^Готово$/ }).first();
      if (await done.count()) { await done.click(); return true; }
      return false;
    },
  },
  {
    name: 'subscription-form',
    screen: 'subscription-form',
    table: 'subscriptions',
    fills: async (page) => {
      const name = page.locator('input[placeholder*="Netflix"]').first();
      if (await name.count()) await name.fill('Тест подписка');
      const amount = page.locator('input[inputmode="decimal"], input[type="number"]').first();
      if (await amount.count()) await amount.fill('990');
    },
    submit: async (page) => {
      // "Добавить" (bottom) или "Сохранить" (header)
      const btn = page.locator('button:visible').filter({ hasText: 'Добавить' }).first();
      if (await btn.count()) { await btn.click(); return true; }
      const save = page.locator('span:visible, button:visible').filter({ hasText: 'Сохранить' }).first();
      if (await save.count()) { await save.click(); return true; }
      return false;
    },
  },
  {
    name: 'document-form',
    screen: 'document-form',
    table: 'documents',
    fills: async (page) => {
      const name = page.locator('input[placeholder*="Название документа"], input[placeholder*="азван"]').first();
      if (await name.count()) await name.fill('Тестовый документ');
    },
    submit: async (page) => {
      const done = page.locator('div:visible, span:visible, button:visible').filter({ hasText: /^Готово$/ }).first();
      if (await done.count()) { await done.click(); return true; }
      return false;
    },
  },
];

async function getCount(page, table) {
  return page.evaluate(async ({ dbName, t }) => {
    try {
      const req = indexedDB.open(dbName);
      return new Promise(resolve => {
        req.onsuccess = () => {
          const db = req.result;
          if (!Array.from(db.objectStoreNames).includes(t)) { db.close(); resolve(-1); return; }
          const tx = db.transaction(t, 'readonly');
          const cr = tx.objectStore(t).count();
          cr.onsuccess = () => { db.close(); resolve(cr.result); };
          cr.onerror = () => { db.close(); resolve(-2); };
        };
        req.onerror = () => resolve(-3);
      });
    } catch { return -4; }
  }, { dbName: DB_NAME, t: table });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('=== CRUD Forms Test v2 ===\n');

  // Setup onboarding
  const setup = await context.newPage();
  await setup.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await setup.waitForTimeout(2000);
  await setup.evaluate(async (dbName) => {
    const req = indexedDB.open(dbName);
    return new Promise(resolve => {
      req.onsuccess = () => {
        const db = req.result;
        if (!Array.from(db.objectStoreNames).includes('settings')) { db.close(); resolve(); return; }
        const tx = db.transaction('settings', 'readwrite');
        const s = tx.objectStore('settings');
        s.put({ key: 'has_completed_onboarding', value: true });
        s.put({ key: 'onboarding_complete', value: 'true' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      req.onerror = () => resolve();
    });
  }, DB_NAME);
  await setup.close();

  const results = [];

  for (const form of FORMS) {
    const page = await context.newPage();
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    try {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      const before = await getCount(page, form.table);

      // Navigate
      await page.evaluate((s) => window.__LIFEOS_NAV?.(s), form.screen);
      await page.waitForTimeout(2500);

      // Debug info
      const inputs = await page.locator('input:visible, textarea:visible').count();
      const buttons = await page.locator('button:visible').count();

      // Fill
      await form.fills(page);
      await page.waitForTimeout(500);

      // Submit
      const submitted = await form.submit(page);
      await page.waitForTimeout(2500);

      const after = await getCount(page, form.table);
      const saved = after > before && before >= 0;

      results.push({
        name: form.name, table: form.table,
        inputs, buttons, submitted, before, after, saved,
        jsErrors: jsErrors.length,
      });

      const icon = saved ? '[OK]' : submitted ? '[WARN]' : '[FAIL]';
      console.log(icon + ' ' + form.name + ': ' + inputs + ' inputs, ' + buttons + ' btns, submit=' + submitted + ', ' + form.table + ': ' + before + ' -> ' + after + (saved ? ' SAVED' : ' NOT SAVED') + (jsErrors.length ? ' (' + jsErrors.length + ' JS err)' : ''));

    } catch (err) {
      results.push({ name: form.name, table: form.table, saved: false, error: err.message });
      console.log('[ERR]  ' + form.name + ': ' + err.message.slice(0, 120));
    }

    await page.close();
  }

  const saved = results.filter(r => r.saved).length;
  const notSaved = results.filter(r => !r.saved).length;

  console.log('\n==========================================');
  console.log('  CRUD Forms v2: ' + results.length + ' forms');
  console.log('  Saved:     ' + saved);
  console.log('  Not saved: ' + notSaved);
  console.log('==========================================');

  if (notSaved > 0) {
    console.log('\nForms NOT saved:');
    for (const r of results.filter(r => !r.saved)) {
      console.log('  ' + r.name + ' (' + r.table + '): before=' + r.before + ' after=' + r.after + ' submit=' + r.submitted + (r.error ? ' err=' + r.error.slice(0, 80) : ''));
    }
  }

  console.log('');
  await browser.close();
  process.exit(notSaved > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(2); });
