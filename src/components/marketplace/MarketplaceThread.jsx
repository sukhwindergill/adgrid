import { useState, useEffect } from 'react';
import { C, F, T } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { fetchOrCreateThread, fetchThreadMessages, sendThreadMessage } from '../../lib/marketplace.js';
import { useToast } from '../primitives/Toast.jsx';
import { useT } from '../../i18n/useT.js';

export function MarketplaceThread({ listingId, operatorId }) {
  const { t } = useT();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchOrCreateThread(listingId, operatorId).then(t => {
      setThread(t);
      return fetchThreadMessages(t.id);
    }).then(msgs => setMessages(msgs ?? []));
  }, [listingId, operatorId]);

  const handleSend = async () => {
    if (!draft.trim() || !thread) return;
    setSending(true);
    try {
      await sendThreadMessage(thread, draft.trim());
      setMessages(prev => [...prev, { id: `temp-${Date.now()}`, body: draft.trim() }]);
      setDraft('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(t('widgets.thread.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
        {messages.map(m => (
          <div key={m.id} style={{
            fontFamily: F.sans, fontSize: T.base, color: C.textMid,
            background: C.surfaceAlt, borderRadius: 8, padding: '8px 12px',
          }}>
            {m.body}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('widgets.thread.placeholder')}
          style={{
            flex: 1, fontFamily: F.sans, fontSize: T.base, padding: '8px 12px',
            border: `1px solid ${C.border}`, borderRadius: 8,
          }}
        />
        <Btn variant="primary" size="sm" onClick={handleSend} disabled={sending || !draft.trim()}>
          {t('widgets.thread.send')}
        </Btn>
      </div>
    </div>
  );
}
