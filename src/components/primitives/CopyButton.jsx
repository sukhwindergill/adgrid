import { useState, useRef, useEffect } from 'react';
import { Btn } from './Btn.jsx';

export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied!', variant = 'secondary', size = 'sm', style = {}, onCopied, onError }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.();
    }
  };

  return (
    <Btn variant={variant} size={size} onClick={copy} style={style}>
      {copied ? copiedLabel : label}
    </Btn>
  );
}
