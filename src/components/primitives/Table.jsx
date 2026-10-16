import { C, F, T } from '../../design/tokens.js';
import { Hover } from './Hover.jsx';

export const Table = ({ columns, rows, empty = 'No data', emptyTitle, emptyDescription, onRowClick }) => (
  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.sans }}>
      <thead>
        <tr style={{ background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
          {columns.map((col, i) => (
            <th key={i} style={{
              padding: '10px 16px', textAlign: 'left', fontSize: T.xs,
              fontWeight: 600, color: C.textSub, textTransform: 'uppercase',
              letterSpacing: '0.4px', whiteSpace: 'nowrap',
            }}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: T.display, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: T.lg, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                {emptyTitle || empty}
              </div>
              {emptyDescription && (
                <div style={{ fontSize: T.base, color: C.textSub }}>{emptyDescription}</div>
              )}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <Hover
              as="tr"
              key={i}
              style={{
                borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              hoverStyle={{ background: C.bg }}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col, j) => (
                <td key={j} style={{ padding: '13px 16px', fontSize: T.base, color: C.textMid, verticalAlign: 'middle' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </Hover>
          ))
        )}
      </tbody>
    </table>
    </div>
  </div>
);
