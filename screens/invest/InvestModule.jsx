import { useState, useCallback, useRef } from 'react';
import NavHeader from '../../components/NavHeader';
import InvestOverview from './InvestOverview';
import AssetDetail from './AssetDetail';
import BrokerDetail from './BrokerDetail';
import TradeForm from './TradeForm';
import TradesList from './TradesList';
import DividendCalendar from './DividendCalendar';
import NetWorthScreen from './NetWorthScreen';
import WatchlistScreen from './WatchlistScreen';
import TaxCalculator from './TaxCalculator';
import InvestTools from './InvestTools';
import FadeIn from '../../components/FadeIn';

export default function InvestModule({ theme, onBack, onToast, onNavigate, initialView }) {
  // Stack-based navigation (not single prevScreen)
  const [stack, setStack] = useState(() => {
    const base = [{ name: 'overview', params: null }];
    if (initialView && initialView !== 'overview') {
      base.push({ name: initialView, params: null });
    }
    return base;
  });
  const navLockRef = useRef(false);

  const current = stack[stack.length - 1];

  const navigate = useCallback((name, params) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setTimeout(() => { navLockRef.current = false; }, 150);
    setStack(s => [...s, { name, params: params ?? null }]);
  }, []);

  const goBack = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    setTimeout(() => { navLockRef.current = false; }, 150);
    setStack(s => {
      if (s.length > 1) return s.slice(0, -1);
      return s;
    });
    if (stack.length <= 1) onBack?.();
  }, [stack.length, onBack]);

  const goToOverview = useCallback(() => {
    setStack([{ name: 'overview', params: null }]);
  }, []);

  const content = (() => {
  switch (current.name) {
    case 'brokerDetail':
      return (
        <BrokerDetail
          broker={current.params}
          theme={theme}
          onBack={goBack}
          onNavigate={navigate}
        />
      );

    case 'assetDetail':
      return (
        <AssetDetail
          assetId={current.params}
          theme={theme}
          onBack={goBack}
          onNavigate={navigate}
        />
      );

    case 'tradeForm':
      return (
        <TradeForm
          theme={theme}
          onBack={goBack}
          initialTicker={current.params || ''}
        />
      );

    case 'dividends':
      return <DividendCalendar theme={theme} onBack={goBack} />;

    case 'trades':
      return <TradesList theme={theme} onBack={goBack} onNavigate={navigate} />;

    case 'networth':
      return <NetWorthScreen theme={theme} onBack={goBack} />;

    case 'watchlist':
      return <WatchlistScreen theme={theme} onBack={goBack} />;

    case 'tax':
      return <TaxCalculator theme={theme} onBack={goBack} />;

    case 'invest-tools':
      return <InvestTools theme={theme} onBack={goBack} onToast={onToast} />;

    default:
      return (
        <>
          <NavHeader
            title="Инвестиции"
            onBack={onBack}
            right={
              <div className="flex gap-3">
                <button onClick={() => navigate('invest-tools')} style={{ color: theme.accent, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'none', border: 'none' }}>
                  🛠
                </button>
                <button onClick={() => navigate('tax')} style={{ color: theme.accent, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'none', border: 'none' }}>
                  🧾
                </button>
                <button onClick={() => navigate('dividends')} style={{ color: theme.accent, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'none', border: 'none' }}>
                  💰
                </button>
                <button onClick={() => navigate('networth')} style={{ color: theme.accent, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'none', border: 'none' }}>
                  📊
                </button>
              </div>
            }
            theme={theme}
          />
          <InvestOverview theme={theme} onNavigate={navigate} />
        </>
      );
  }
  })();

  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      <FadeIn key={current.name}>{content}</FadeIn>
    </div>
  );
}
