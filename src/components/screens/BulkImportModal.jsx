import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../primitives/Btn.jsx';
import { Modal } from '../primitives/Modal.jsx';
import { downloadCsv } from '../../lib/csv.js';
import { geocodeAddress } from '../../lib/geocodeAddress.js';
import { parseScreenCsv, validateImportRow, buildScreenInsertPayload, IMPORT_CSV_COLUMNS } from '../../lib/screenCsvImport.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/useT.js';

function downloadTemplate() {
  downloadCsv('screens-import-template.csv', IMPORT_CSV_COLUMNS.map(c => ({ key: c, label: c })), []);
}

// CSV Bulk Screen Import (docs/superpowers/specs/2026-09-08-csv-bulk-
// screen-import-design.md). Parse -> validate -> (geocode rows missing
// lat/lng) -> confirm -> one batched insert.
export function BulkImportModal({ onClose, onImported }) {
  const { t } = useT();
  const { user } = useAuth();
  const [phase, setPhase] = useState('pick'); // pick | checking | ready | importing | done
  const [fileError, setFileError] = useState(null);
  const [results, setResults] = useState([]); // [{ row, errors, geocoding }]
  const [importError, setImportError] = useState(null);
  const [imported, setImported] = useState([]);

  const validCount = results.filter(r => r.errors.length === 0).length;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setPhase('checking');
    const text = await file.text();
    const { rows, error } = parseScreenCsv(text);
    if (error) {
      setFileError(error);
      setPhase('pick');
      return;
    }

    let validated = rows.map((row, i) => {
      const { row: r, errors } = validateImportRow(row, i);
      return { row: r, errors, geocoding: errors.includes('needs geocoding') };
    });

    // Resolve geocoding candidates before finalizing the results table --
    // a geocode miss becomes a validation error, not a silent lat: null.
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    validated = await Promise.all(validated.map(async (r) => {
      if (!r.geocoding) return r;
      const query = `${r.row.location}, ${r.row.city}, ${r.row.state}`;
      const coords = await geocodeAddress(query, token).catch(() => null);
      if (!coords) {
        return { row: r.row, errors: [t('scr.bulk.geocodeMiss', { query })], geocoding: false };
      }
      const nextRow = { ...r.row, lat: String(coords.lat), lng: String(coords.lng) };
      const { errors } = validateImportRow(nextRow, r.row._rowNum - 2);
      return { row: nextRow, errors, geocoding: false };
    }));

    setResults(validated);
    setPhase('ready');
  }

  async function handleImport() {
    setPhase('importing');
    setImportError(null);
    const validRows = results.filter(r => r.errors.length === 0).map(r => r.row);
    const payloads = validRows.map(row => buildScreenInsertPayload(row, user.id));

    const { data, error } = await supabase.from('screens').insert(payloads).select('id, name');
    if (error) {
      setImportError(error.message);
      setPhase('ready');
      return;
    }
    setImported(data ?? []);
    setPhase('done');
    onImported?.(data ?? []);
  }

  return (
    <Modal title={t('scr.bulk.title')} onClose={onClose} maxWidth={640}>

        {phase === 'pick' && (
          <div>
            <div style={{ ...TX.bodySub, marginBottom: 16 }}>
              {t('scr.bulk.intro')}
            </div>
            <Btn variant="ghost" size="sm" onClick={downloadTemplate} style={{ marginBottom: 16 }}>{t('scr.bulk.template')}</Btn>
            <input type="file" accept=".csv" onChange={handleFile} />
            {fileError && <div style={{ ...TX.error, marginTop: 12 }}>{fileError}</div>}
          </div>
        )}

        {phase === 'checking' && (
          <div style={TX.bodySub}>{t('scr.bulk.checking')}</div>
        )}

        {(phase === 'ready' || phase === 'importing') && (
          <div>
            <div style={{ ...TX.bodySub, marginBottom: 12 }}>
              {t('scr.bulk.ready', { valid: validCount, count: results.length })}
            </div>
            {importError && <div style={{ ...TX.error, marginBottom: 12 }}>{importError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
              {results.map(r => (
                <div key={r.row._rowNum} style={{ padding: '8px 10px', borderRadius: 8, background: r.errors.length > 0 ? C.redSoft : C.surfaceAlt, fontSize: T.sm, fontFamily: F.sans }}>
                  <span style={{ fontWeight: 600 }}>{t('scr.bulk.row', { n: r.row._rowNum, name: r.row.name || t('scr.bulk.noName') })}</span>
                  {r.errors.length > 0 ? (
                    <span style={{ color: C.redText }}> — {r.errors.join('; ')}</span>
                  ) : (
                    <span style={{ color: C.greenText }}>{t('scr.bulk.valid')}</span>
                  )}
                </div>
              ))}
            </div>
            <Btn onClick={handleImport} disabled={validCount === 0 || phase === 'importing'}>
              {phase === 'importing' ? t('scr.bulk.importing') : t('scr.bulk.import', { count: validCount })}
            </Btn>
          </div>
        )}

        {phase === 'done' && (
          <div>
            <div style={{ ...TX.body, marginBottom: 12 }}>
              {t('scr.bulk.imported', { count: imported.length })}
            </div>
            <Btn onClick={onClose}>{t('scr.bulk.done')}</Btn>
          </div>
        )}
    </Modal>
  );
}
