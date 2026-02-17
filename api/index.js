/**
 * API Barrel — все внешние интеграции.
 */
export { chatCompletion, streamCompletion, MODELS, LIMITS } from './openrouter';
export { searchFood, getFoodDetail } from './fatSecret';
export { searchFoodOFF, getByBarcode } from './openFoodFacts';
export { getQuotes, getQuoteHistory, searchTicker, isTradingHours } from './moex';
export { getExchangeRates, convert, getHistoricalRate } from './frankfurter';
