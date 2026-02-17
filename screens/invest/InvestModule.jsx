import { useState, useCallback } from 'react';
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

export default function InvestModule({ theme, onBack, onToast }) {
  // Internal navigation stack
  const [screen, setScreen] = useState({ name: 'overview', params: null });
  const [prevScreen, setPrevScreen] = useState(null);

  const navigate = useCallback((name, params) => {
    setPrevScreen(screen);
    setScreen({ name, params });
  }, [screen]);

  const goToOverview = useCallback(() => {
    setScreen({ name: 'overview', params: null });
    setPrevScreen(null);
  }, []);

  const goBack = useCallback(() => {
    if (prevScreen) {
      setScreen(prevScreen);
      setPrevScreen(null);
    } else {
      goToOverview();
    }
  }, [prevScreen, goToOverview]);

  const content = (() => {
  switch (screen.name) {
    case 'brokerDetail':
      return (
        <BrokerDetail
          broker={screen.params}
          theme={theme}
          onBack={goToOverview}
          onNavigate={navigate}
        />
      );

    case 'assetDetail':
      return (
        <AssetDetail
          assetId={screen.params}
          theme={theme}
          onBack={goBack}
          onNavigate={navigate}
        />
      );

    case 'tradeForm':
      return (
        <TradeForm
          theme={theme}
          onBack={goToOverview}
          initialTicker={screen.params || ''}
        />
      );

    case 'dividends':
      return <DividendCalendar theme={theme} onBack={goToOverview} />;

    case 'trades':
      return <TradesList theme={theme} onBack={goToOverview} onNavigate={navigate} />;

    case 'networth':
      return <NetWorthScreen theme={theme} onBack={goToOverview} />;

    case 'watchlist':
      return <WatchlistScreen theme={theme} onBack={goToOverview} />;

    case 'tax':
      return <TaxCalculator theme={theme} onBack={goToOverview} />;

    case 'invest-tools':
      return <InvestTools theme={theme} onBack={goToOverview} onToast={onToast} />;

    default:
      return (
        <div className="flex flex-col h-full">
          <NavHeader
            title="Инвестиции"
            onBack={onBack}
            right={
              <div className="flex gap-3">
                <button onClick={() => navigate('invest-tools')} className="text-sm" style={{ color: theme.accent }}>
                  🛠
                </button>
                <button onClick={() => navigate('tax')} className="text-sm" style={{ color: theme.accent }}>
                  🧾
                </button>
                <button onClick={() => navigate('dividends')} className="text-sm" style={{ color: theme.accent }}>
                  💰
                </button>
                <button onClick={() => navigate('networth')} className="text-sm" style={{ color: theme.accent }}>
                  📊
                </button>
              </div>
            }
            theme={theme}
          />
          <InvestOverview theme={theme} onNavigate={navigate} />
        </div>
      );
  }
  })();

  return <FadeIn key={screen.name}>{content}</FadeIn>;
}
