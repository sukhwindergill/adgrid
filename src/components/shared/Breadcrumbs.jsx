import { Link } from 'react-router-dom';

const nav = { fontFamily: "'Inter', sans-serif", fontSize: 13, marginBottom: 24 };
const link = { color: 'rgba(255,255,255,0.5)', textDecoration: 'none' };
const sep = { color: 'rgba(255,255,255,0.3)', margin: '0 8px' };
const current = { color: 'rgba(255,255,255,0.85)' };

// items: [{ label, to? }]. The last item is rendered as plain text (it's
// the current page — linking to yourself is a no-op at best, confusing at
// worst); every earlier item must have a `to`.
export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" style={nav}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.label}>
            {isLast ? (
              <span style={current}>{item.label}</span>
            ) : (
              <Link to={item.to} style={link}>{item.label}</Link>
            )}
            {!isLast && <span style={sep} aria-hidden="true">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
