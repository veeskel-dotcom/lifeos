import { useState, useEffect } from 'react';

export default function IOSKeyboardSpacer() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handler = () => {
      const diff = window.innerHeight - window.visualViewport.height;
      setHeight(diff > 100 ? diff : 0);
    };

    window.visualViewport.addEventListener('resize', handler);
    return () => window.visualViewport.removeEventListener('resize', handler);
  }, []);

  if (height === 0) return null;
  return <div style={{ height, flexShrink: 0 }} />;
}
