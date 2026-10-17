import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { KPI } from '../../components/primitives/KPI.jsx';
import { Card } from '../../components/primitives/Card.jsx';
import { EmptyState } from '../../components/primitives/EmptyState.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { Table } from '../../components/primitives/Table.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Tabs } from '../../components/primitives/Tabs.jsx';
import { ProgressBar } from '../../components/primitives/ProgressBar.jsx';
import { SkeletonTable, SkeletonRow } from '../../components/primitives/Skeleton.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { IconQr, IconMail, IconGlobe } from '../../components/icons.jsx';
import { useT } from '../../i18n/useT.js';

function useScans() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase
      .from('scans')
      .select('id, scanned_at, device_type, city, email, consent, campaign_id')
      .order('scanned_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        // A failed fetch previously left scans empty just like a genuine
        // zero-scans account, showing "No scans yet" as if no campaign had
        // ever run -- misleading when the query never actually ran.
        setLoadError(Boolean(error));
        if (data) setScans(data.map(s => ({
          id:         s.id,
          ts:         s.scanned_at,
          advertiser: '—',
          screen:     '—',
          city:       s.city ?? '—',
          device:     s.device_type ?? '—',
          consent:    s.consent ?? false,
          email:      s.email ?? null,
          age:        null,
          gender:     null,
        })));
        setLoading(false);
      });
  }, []);

  return { scans, loading, loadError };
}

export function Audience() {
  const [tab, setTab] = useState('scans');
  const [exportDone, setExportDone] = useState(false);
  const { scans, loading, loadError } = useScans();
  const { isMobile, isTablet } = useBreakpoint();
  const { t, tx, formatDate, formatDateTime, formatNumber } = useT();

  const consented   = scans.filter(s => s.consent);
  const consentRate = scans.length > 0 ? Math.round((consented.length / scans.length) * 100) : 0;

  const doExport = () => {
    const csv = ['email,city,device,scanned_at', ...consented.filter(s => s.email).map(s => `${s.email},${s.city},${s.device},${s.ts}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'adgrid-remarketing.csv';
    a.click();
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}><SkeletonRow cols={4} /></div>
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('op.audience.title')} subtitle={t('op.audience.subtitle')}
        actions={<Btn onClick={doExport} variant={exportDone ? 'success' : 'primary'} icon="↓" disabled={consented.filter(s => s.email).length === 0}>{exportDone ? t('op.audience.exported') : t('op.audience.export')}</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label={t('op.audience.kpiTotal')} value={formatNumber(scans.length)} sub={t('op.audience.kpiTotalSub')} icon={<IconQr size={16} />} />
        <KPI label={t('op.audience.kpiConsent')} value={consentRate + '%'} sub={t('op.audience.kpiConsentSub')} color={C.green} icon="✓" />
        <KPI label={t('op.audience.kpiList')} value={t('op.audience.emails', { count: consented.filter(s => s.email).length })} sub={t('op.audience.kpiListSub')} color={C.purple} icon={<IconMail size={16} />} />
        <KPI label={t('op.audience.kpiCities')} value={new Set(scans.map(s => s.city).filter(c => c !== '—')).size} sub={t('op.audience.kpiCitiesSub')} icon={<IconGlobe size={16} />} />
      </div>

      <Card style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ ...TX.helper, lineHeight: 1.7 }}>
          {tx('op.audience.how', { b: chunk => <strong style={{ color: C.text }}>{chunk}</strong> })}
        </div>
      </Card>

      {scans.length === 0 && (
        <EmptyState style={{ marginBottom: 16 }}>
          <div style={{ color: loadError ? C.redText : C.textMuted, marginBottom: 10, display: 'flex', justifyContent: 'center' }}><IconQr size={32} /></div>
          {loadError ? (
            <>
              <div style={{ fontSize: T.lg, fontWeight: 600, color: C.redText, fontFamily: F.sans, marginBottom: 6 }}>{t('op.audience.loadError')}</div>
              <div style={TX.bodySub}>{t('op.audience.loadErrorSub')}</div>
            </>
          ) : (
            <>
              <div style={{ ...TX.titleLg, marginBottom: 6 }}>{t('op.audience.empty')}</div>
              <div style={TX.bodySub}>{t('op.audience.emptySub')}</div>
            </>
          )}
        </EmptyState>
      )}

      {scans.length > 0 && (
        <>
          <Tabs tabs={[{ id: 'scans', label: t('op.audience.tabFeed') }, { id: 'remarketing', label: t('op.audience.tabRemarketing') }]} active={tab} onChange={setTab} />

          {tab === 'scans' && (
            <Table
              columns={[
                { key: 'ts',      label: t('op.audience.time'), render: v => <span style={TX.mono}>{formatDateTime(v)}</span> },
                { key: 'city',    label: t('op.audience.city') },
                { key: 'device',  label: t('op.audience.device') },
                { key: 'consent', label: t('op.audience.consent'), render: v => <Badge status={v ? 'active' : 'paused'}>{v ? t('op.audience.given') : t('op.audience.declined')}</Badge> },
                { key: 'email',   label: t('op.audience.email'), render: v => v ? <span style={{ fontFamily: F.mono, fontSize: T.xs, color: C.purple }}>{v}</span> : <span style={{ color: C.textMuted, fontSize: T.xs }}>{t('op.audience.anonymous')}</span> },
              ]}
              rows={scans} />
          )}

          {tab === 'remarketing' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <Card style={{ padding: '14px 18px', background: C.blueSoft, border: `1px solid ${C.blueBorder}` }}>
                  <div style={{ fontSize: T.base, fontWeight: 600, color: C.blueText, fontFamily: F.sans, marginBottom: 4 }}>{t('op.audience.googleTitle')}</div>
                  <div style={{ ...TX.helper, lineHeight: 1.6 }}>{t('op.audience.googleBody')}</div>
                </Card>
                <Card style={{ padding: '14px 18px', background: C.purpleSoft, border: `1px solid ${C.purpleBorder}` }}>
                  <div style={{ fontSize: T.base, fontWeight: 600, color: C.purple, fontFamily: F.sans, marginBottom: 4 }}>{t('op.audience.metaTitle')}</div>
                  <div style={{ ...TX.helper, lineHeight: 1.6 }}>{t('op.audience.metaBody')}</div>
                </Card>
              </div>
              <Table
                columns={[
                  { key: 'email',  label: t('op.audience.email'), render: v => <span style={{ fontFamily: F.mono, fontSize: T.sm, color: C.purple }}>{v}</span> },
                  { key: 'city',   label: t('op.audience.city') },
                  { key: 'device', label: t('op.audience.device') },
                  { key: 'ts',     label: t('op.audience.scanned'), render: v => <span style={TX.mono}>{formatDate(v)}</span> },
                ]}
                rows={consented.filter(s => s.email)}
                emptyTitle={t('op.audience.noConsented')} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
