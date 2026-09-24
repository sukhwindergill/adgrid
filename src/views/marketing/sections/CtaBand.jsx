import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReveal } from './useReveal.js';
import { supabase } from '../../../lib/supabase.js';
import { getUtmLabel } from '../../../lib/utm.js';

export function applyUtmPrefill(prev, label) {
  return prev.source ? prev : { ...prev, source: label };
}

const ROLE_COPY = {
  operator: {
    eyebrow: 'Early operator access',
    sub: "We're onboarding a first group of screen operators before public launch. Early operators get priority placement and hands-on onboarding support.",
    company: 'Company or venue name',
    companyPlaceholder: 'Name of your business or network',
    submit: 'Join the operator waitlist',
  },
  advertiser: {
    eyebrow: 'Early advertiser access',
    sub: "We're lining up a first group of local advertisers for launch. Early advertisers get first pick of screens in their neighbourhood and help setting up their first campaign.",
    company: 'Business name',
    companyPlaceholder: 'The business you want to advertise',
    submit: 'Join the advertiser waitlist',
  },
};

// `role` is controlled by the page (so hero/section CTAs can pre-select a
// side) but falls back to local state when rendered standalone.
export function CtaBand({ role: roleProp, onRoleChange }) {
  const [ref, on] = useReveal();
  const navigate = useNavigate();
  const [localRole, setLocalRole] = useState(roleProp ?? 'operator');
  const role = roleProp ?? localRole;
  const setRole = next => { setLocalRole(next); onRoleChange?.(next); };
  const copy = ROLE_COPY[role];
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
      setSubmitErr('Something went wrong. Please try again.');
      return;
    }
    navigate('/thank-you');
  };

  return (
    <section className="sec dark" id="waitlist-form" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ textAlign: 'center' }}>
        <div className="eyebrow">{copy.eyebrow}</div>
        <h2 className="sec-h">Launching in Toronto and Vancouver</h2>
        <p className="sec-sub" style={{ margin: '14px auto 0' }}>{copy.sub}</p>

        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <div className="role-toggle" role="radiogroup" aria-label="I'm joining as">
              {[['operator', 'I have screens'], ['advertiser', 'I want to advertise']].map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={role === value}
                  className={`role-opt ${role === value ? 'on' : ''}`} onClick={() => setRole(value)}>
                  {label}
                </button>
              ))}
            </div>

            {[
              { id: 'wl-name', label: 'Full name', field: 'name', type: 'text', placeholder: 'Jane Smith' },
              { id: 'wl-email', label: 'Work email', field: 'email', type: 'email', placeholder: 'jane@yourcompany.com', required: true },
              { id: 'wl-company', label: copy.company, field: 'company', type: 'text', placeholder: copy.companyPlaceholder },
            ].map(f => (
              <div className="form-field" key={f.id}>
                <label htmlFor={f.id} className="form-label">{f.label}</label>
                <input id={f.id} className="fi" type={f.type} placeholder={f.placeholder}
                  value={form[f.field]} onChange={set(f.field)} required={!!f.required} />
              </div>
            ))}

            <div className="form-field">
              <label htmlFor="wl-city" className="form-label">City</label>
              <select id="wl-city" className="fi" value={form.city} onChange={set('city')}>
                <option value="">Select city…</option>
                <option value="toronto">Toronto</option>
                <option value="vancouver">Vancouver</option>
                <option value="other-ca">Other Canadian city</option>
                <option value="multiple">Multiple cities</option>
              </select>
            </div>

            {role === 'operator' && (
              <div className="form-field">
                <label htmlFor="wl-screens" className="form-label">Number of screens</label>
                <select id="wl-screens" className="fi" value={form.screens} onChange={set('screens')}>
                  <option value="">Select range…</option>
                  <option value="1-5">1-5</option>
                  <option value="6-20">6-20</option>
                  <option value="21-100">21-100</option>
                  <option value="100+">100+</option>
                  <option value="not-yet">Not yet deployed</option>
                </select>
              </div>
            )}

            <div className="form-field" style={{ marginBottom: 28 }}>
              <label htmlFor="wl-source" className="form-label">
                How did you hear about AdGrid? <span style={{ color: 'var(--sec)' }}>(optional)</span>
              </label>
              <input id="wl-source" className="fi" type="text" value={form.source} onChange={set('source')} />
            </div>

            <button type="submit" className="btn-p" style={{ width: '100%', padding: 15 }} disabled={submitting}>
              {submitting ? 'Submitting…' : copy.submit}
            </button>

            {submitErr && (
              <p style={{ font: '400 13px/1.5 var(--inter)', color: '#f87171', textAlign: 'center', marginTop: 12 }}>
                {submitErr}
              </p>
            )}

            <p style={{ font: '400 13px/1.5 var(--inter)', color: 'var(--sec)', textAlign: 'center', marginTop: 16 }}>
              We'll respond within 2 business days. By submitting, you agree to our{' '}
              <Link to="/privacy" style={{ color: 'var(--sec)' }}>Privacy Policy</Link>. We'll never share your information.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
