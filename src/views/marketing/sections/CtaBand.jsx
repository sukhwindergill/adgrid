import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReveal } from './useReveal.js';
import { supabase } from '../../../lib/supabase.js';
import { getUtmLabel } from '../../../lib/utm.js';
import { track } from '../../../lib/analytics.js';
import { useT } from '../../../i18n/useT.js';

export function applyUtmPrefill(prev, label) {
  return prev.source ? prev : { ...prev, source: label };
}


// `role` is controlled by the page (so hero/section CTAs can pre-select a
// side) but falls back to local state when rendered standalone.
export function CtaBand({ role: roleProp, onRoleChange }) {
  const { t, tx } = useT();
  const [ref, on] = useReveal();
  const navigate = useNavigate();
  const [localRole, setLocalRole] = useState(roleProp ?? 'operator');
  const role = roleProp ?? localRole;
  const setRole = next => { setLocalRole(next); onRoleChange?.(next); };
  const copyKey = key => t(`marketing.waitlist.${role}.${key}`);
  const [form, setForm] = useState({ name: '', email: '', company: '', city: '', screens: '', source: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  useEffect(() => {
    const label = getUtmLabel();
    if (label) {
      setForm(prev => applyUtmPrefill(prev, label));
    }
  }, []);

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setSubmitErr(null);
    const { error } = await supabase.from('waitlist_entries').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      company: form.company.trim() || null,
      city: form.city || null,
      screens: role === 'operator' ? (form.screens || null) : null,
      role,
      source: form.source.trim() || null,
    });
    setSubmitting(false);
    if (error && !error.message?.includes('duplicate')) {
      setSubmitErr(t('marketing.waitlist.error'));
      return;
    }
    track('waitlist_submitted', { role });
    navigate(`/thank-you?role=${role}`);
  };

  return (
    <section className="sec dark" id="waitlist-form" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ textAlign: 'center' }}>
        <div className="eyebrow">{copyKey('eyebrow')}</div>
        <h2 className="sec-h">{t('marketing.waitlist.heading')}</h2>
        <p className="sec-sub" style={{ margin: '14px auto 0' }}>{copyKey('sub')}</p>

        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <div className="role-toggle" role="radiogroup" aria-label={t('marketing.waitlist.joiningAs')}>
              {[['operator', t('marketing.waitlist.roleOperator')], ['advertiser', t('marketing.waitlist.roleAdvertiser')]].map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={role === value}
                  className={`role-opt ${role === value ? 'on' : ''}`} onClick={() => setRole(value)}>
                  {label}
                </button>
              ))}
            </div>

            {[
              { id: 'wl-name', label: t('marketing.waitlist.name'), field: 'name', type: 'text', placeholder: t('marketing.waitlist.namePlaceholder') },
              { id: 'wl-email', label: t('marketing.waitlist.email'), field: 'email', type: 'email', placeholder: t('marketing.waitlist.emailPlaceholder'), required: true },
              { id: 'wl-company', label: copyKey('company'), field: 'company', type: 'text', placeholder: copyKey('companyPlaceholder') },
            ].map(f => (
              <div className="form-field" key={f.id}>
                <label htmlFor={f.id} className="form-label">{f.label}</label>
                <input id={f.id} className="fi" type={f.type} placeholder={f.placeholder}
                  value={form[f.field]} onChange={set(f.field)} required={!!f.required} />
              </div>
            ))}

            <div className="form-field">
              <label htmlFor="wl-city" className="form-label">{t('marketing.waitlist.city')}</label>
              <select id="wl-city" className="fi" value={form.city} onChange={set('city')}>
                <option value="">{t('marketing.waitlist.cityPlaceholder')}</option>
                <option value="toronto">{t('marketing.waitlist.cityToronto')}</option>
                <option value="vancouver">{t('marketing.waitlist.cityVancouver')}</option>
                <option value="other-ca">{t('marketing.waitlist.cityOther')}</option>
                <option value="multiple">{t('marketing.waitlist.cityMultiple')}</option>
              </select>
            </div>

            {role === 'operator' && (
              <div className="form-field">
                <label htmlFor="wl-screens" className="form-label">{t('marketing.waitlist.screens')}</label>
                <select id="wl-screens" className="fi" value={form.screens} onChange={set('screens')}>
                  <option value="">{t('marketing.waitlist.screensPlaceholder')}</option>
                  <option value="1-5">1-5</option>
                  <option value="6-20">6-20</option>
                  <option value="21-100">21-100</option>
                  <option value="100+">100+</option>
                  <option value="not-yet">{t('marketing.waitlist.screensNotYet')}</option>
                </select>
              </div>
            )}

            <div className="form-field" style={{ marginBottom: 28 }}>
              <label htmlFor="wl-source" className="form-label">
                {t('marketing.waitlist.source')} <span style={{ color: 'var(--sec)' }}>{t('common.optional')}</span>
              </label>
              <input id="wl-source" className="fi" type="text" value={form.source} onChange={set('source')} />
            </div>

            <button type="submit" className="btn-p" style={{ width: '100%', padding: 15 }} disabled={submitting}>
              {submitting ? t('marketing.waitlist.submitting') : copyKey('submit')}
            </button>

            {submitErr && (
              <p style={{ font: '400 13px/1.5 var(--inter)', color: '#f87171', textAlign: 'center', marginTop: 12 }}>
                {submitErr}
              </p>
            )}

            <p style={{ font: '400 13px/1.5 var(--inter)', color: 'var(--sec)', textAlign: 'center', marginTop: 16 }}>
              {tx('marketing.waitlist.privacy', {
                privacy: chunk => <Link to="/privacy" style={{ color: 'var(--sec)' }}>{chunk}</Link>,
              })}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
