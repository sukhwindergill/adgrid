// src/views/advertiser/createCampaign/MessageQuickFill.jsx
import { useState } from 'react';
import { C, F } from '../../../design/tokens.js';

export function MessageQuickFill({ onFill }) {
  const [message, setMessage] = useState('');
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
        Describe your ad in one line <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={message}
          maxLength={120}
          placeholder="e.g. Fresh cold brew, delivered daily, Order now"
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFill(message); } }}
          style={{
            flex: 1, padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
            fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface,
          }}
        />
        <button type="button" onClick={() => onFill(message)} disabled={!message.trim()} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none',
          background: message.trim() ? C.purple : C.border, color: '#fff',
          cursor: message.trim() ? 'pointer' : 'default', fontFamily: F.sans, fontSize: 13, fontWeight: 500,
        }}>Fill in →</button>
      </div>
    </div>
  );
}
