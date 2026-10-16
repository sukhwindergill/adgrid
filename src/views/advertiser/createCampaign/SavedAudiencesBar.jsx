import { useEffect, useState } from 'react';
import { C, F } from '../../../design/tokens.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useToast } from '../../../components/primitives/Toast.jsx';
import { listTargetingTemplates, saveTargetingTemplate, deleteTargetingTemplate, applyTargetingTemplate } from '../../../lib/targetingTemplates.js';
import { IconBookmark } from '../../../components/icons.jsx';
import { useT } from '../../../i18n/useT.js';

// A media buyer running recurring campaigns previously rebuilt targeting
// (area + screen type) from scratch every time — the only "reuse" was
// per-browser localStorage drafts of an entire in-progress wizard, not a
// named, cross-device audience they could pick from a list. This is the
// save/apply UI for campaign_targeting_templates (see the migration for
// what's actually stored — targeting only, not budget/dayparting/creative).
export function SavedAudiencesBar({ form, onApply }) {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useT();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState(null); // null = not editing; string = draft name

  const refresh = () => {
    setLoading(true);
    listTargetingTemplates().then(rows => { setTemplates(rows); setLoading(false); });
  };
  useEffect(() => { refresh(); }, []);

  const handleSave = async () => {
    const name = (nameInput ?? '').trim();
    if (!name) return;
    setSaving(true);
    try {
      await saveTargetingTemplate(user.id, name, form);
      toast.success(t('create.audiences.saved', { name }));
      setNameInput(null);
      refresh();
    } catch (e) {
      toast.error(e.message ?? t('create.audiences.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteTargetingTemplate(id);
      setTemplates(prev => prev.filter(tpl => tpl.id !== id));
    } catch {
      toast.error(t('create.audiences.removeFailed', { name }));
    }
  };

  if (loading) return null;

  return (
    <div style={{ marginBottom: 20, padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, fontFamily: F.sans, marginBottom: templates.length > 0 || nameInput !== null ? 8 : 0 }}>
        {t('create.audiences.title')}
      </div>

      {templates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 12px',
              border: `1px solid ${C.border}`, borderRadius: 20, background: C.surface,
            }}>
              <button onClick={() => onApply(applyTargetingTemplate(tpl))} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                color: C.text, fontFamily: F.sans, fontWeight: 500, padding: 0,
              }}>{tpl.name}</button>
              <button onClick={() => handleDelete(tpl.id, tpl.name)} aria-label={t('create.audiences.deleteLabel', { name: tpl.name })} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
                fontSize: 13, lineHeight: 1, padding: '0 2px',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {nameInput === null ? (
        <button onClick={() => setNameInput('')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer',
          fontFamily: F.sans, padding: 0, fontWeight: 500,
        }}><IconBookmark size={13} /> {t('create.audiences.saveCurrent')}</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setNameInput(null); }}
            placeholder={t('create.audiences.placeholder')}
            style={{
              flex: 1, minWidth: 0, padding: '6px 10px', border: `1px solid ${C.border}`,
              borderRadius: 6, fontSize: 12, fontFamily: F.sans, color: C.text,
            }}
          />
          <button onClick={handleSave} disabled={saving || !nameInput.trim()} style={{
            padding: '6px 12px', borderRadius: 6, border: 'none', background: C.purple,
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving || !nameInput.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
          }}>{saving ? t('common.saving') : t('common.save')}</button>
          <button onClick={() => setNameInput(null)} style={{
            background: 'none', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: F.sans,
          }}>{t('common.cancel')}</button>
        </div>
      )}
    </div>
  );
}
