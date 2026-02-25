import { useState } from 'react';
import FadeIn from '../../components/FadeIn';
import SettingsScreen from './SettingsScreen';
import ProfileEditor from './ProfileEditor';
import SecuritySettings from './SecuritySettings';
import AISettings from './AISettings';
import DataSettings from './DataSettings';
import NotificationsScreen from './NotificationsScreen';
import AnalyticsScreen from './AnalyticsScreen';
import AboutScreen from './AboutScreen';
import AppearanceScreen from './AppearanceScreen';
import ErrorLogScreen from './ErrorLogScreen';
import SyncSettings from './SyncSettings';

export default function SettingsModule({ theme, onBack, onThemeChange, initialView }) {
  const [view, setView] = useState(initialView || 'main');

  const goBack = () => setView('main');

  const content = (() => {
    switch (view) {
      case 'profile':
        return <ProfileEditor theme={theme} onBack={goBack} />;
      case 'security':
        return <SecuritySettings theme={theme} onBack={goBack} />;
      case 'ai':
        return <AISettings theme={theme} onBack={goBack} />;
      case 'data':
        return <DataSettings theme={theme} onBack={goBack} />;
      case 'notifications':
        return <NotificationsScreen theme={theme} onBack={goBack} />;
      case 'analytics':
        return <AnalyticsScreen theme={theme} onBack={goBack} />;
      case 'about':
        return <AboutScreen theme={theme} onBack={goBack} />;
      case 'appearance':
        return <AppearanceScreen theme={theme} onBack={goBack} onThemeChange={onThemeChange} />;
      case 'error-log':
        return <ErrorLogScreen theme={theme} onBack={goBack} />;
      case 'sync':
        return <SyncSettings theme={theme} onBack={goBack} />;
      default:
        return (
          <SettingsScreen
            theme={theme}
            onBack={onBack}
            onThemeChange={onThemeChange}
            onNavigate={setView}
          />
        );
    }
  })();

  return <FadeIn key={view}>{content}</FadeIn>;
}

export { default as SettingsScreen } from './SettingsScreen';
export { default as ProfileEditor } from './ProfileEditor';
export { default as SecuritySettings } from './SecuritySettings';
export { default as AISettings } from './AISettings';
export { default as DataSettings } from './DataSettings';
