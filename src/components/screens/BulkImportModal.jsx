import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { downloadCsv } from '../../lib/csv.js';
import { geocodeAddress } from '../../lib/geocodeAddress.js';
import { parseScreenCsv, validateImportRow, buildScreenInsertPayload, IMPORT_CSV_COLUMNS } from '../../lib/screenCsvImport.js';
import { useAuth } from '../../context/AuthContext.jsx';

function downloadTemplate() {
  downloadCsv('screens-import-template.csv', IMPORT_CSV_COLUMNS.map(c => ({ key: c, label: c })), []);
}

// CSV Bulk Screen Import (docs/superpowers/specs/2026-09-08-csv-bulk-
// screen-import-design.md). Parse -> validate -> (geocode rows missing
// lat/lng) -> confirm -> one batched insert.
export function BulkImportModal({ onClose, onImported }) {
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
        return { row: r.row, errors: [`couldn't locate this address ("${query}") -- add lat/lng manually or fix the address`], geocoding: false };
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Bulk Import Screens</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>

        {phase === 'pick' && (
          <div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 16 }}>
              Upload a CSV of your screens to register them all at once. Each row needs the same info as registering one screen manually.
            </div>
            <Btn variant="ghost" size="sm" onClick={downloadTemplate} style={{ marginBottom: 16 }}>↓ Download template</Btn>
            <input type="file" accept=".csv" onChange={handleFile} />
            {fileError && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 12 }}>{fileError}</div>}
          </div>
        )}

        {phase === 'checking' && (
          <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>Checking your file…</div>
        )}

        {(phase === 'ready' || phase === 'importing') && (
          <div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
              {validCount} of {results.length} row{results.length !== 1 ? 's' : ''} ready to import.
            </div>
            {importError && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{importError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
              {results.map(r => (
                <div key={r.row._rowNum} style={{ padding: '8px 10px', borderRadius: 8, background: r.errors.length > 0 ? C.redSoft : C.surfaceAlt, fontSize: 12, fontFamily: F.sans }}>
                  <span style={{ fontWeight: 600 }}>Row {r.row._rowNum}: {r.row.name || '(no name)'}</span>
                  {r.errors.length > 0 ? (
                    <span style={{ color: C.red }}> — {r.errors.join('; ')}</span>
                  ) : (
                    <span style={{ color: C.green }}> — valid</span>
                  )}
                </div>
              ))}
            </div>
            <Btn onClick={handleImport} disabled={validCount === 0 || phase === 'importing'}>
              {phase === 'importing' ? 'Importing…' : `Import ${validCount} valid row${validCount !== 1 ? 's' : ''}`}
            </Btn>
          </div>
        )}

        {phase === 'done' && (
          <div>
            <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>
              {imported.length} screen{imported.length !== 1 ? 's' : ''} imported successfully.
            </div>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
