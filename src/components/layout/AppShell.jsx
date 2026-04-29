import { C } from '../../design/tokens.js';

export function AppShell({ header, children }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {header}
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 28px 60px' }}>
        {children}
      </main>
    </div>
  );
}
