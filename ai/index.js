/**
 * AI module — точка входа.
 * Используется: AIChatScreen, BriefingCard, crossAnalysis.
 */

export { processInput } from './cascade';
export { callAI, callAIStream, callAIVision, isAIAvailable, getAIStatus } from './client';
export { trackUsage, checkLimits, getLimitsStatus } from './cost';
export { saveCorrection, findCorrection, getAllCorrections } from './corrections';
export { isVoiceSupported, startListening } from './voice';
export { executeAction } from './execute';
