export default function FadeIn({ children }) {
  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {children}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
