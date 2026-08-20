const keyframes = `
@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}`;

if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const s = document.createElement('style');
  s.id = 'spinner-style';
  s.textContent = keyframes;
  document.head.appendChild(s);
}

export function Spinner({ size = 14, style = {} }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        animation: 'spinner-rotate 0.6s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
