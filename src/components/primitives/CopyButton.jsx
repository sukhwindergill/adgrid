import { useState, useRef, useEffect } from 'react';
import { Btn } from './Btn.jsx';

export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied!', variant = 'secondary', size = 'sm', style = {}, onCopied }) {
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
      // Clipboard write can fail (permissions, insecure context, etc).
      // Silently no-op — callers that need a failure UI handle it themselves
      // via their own error toast, same as before this component existed.
    }
  };

  return (
    <Btn variant={variant} size={size} onClick={copy} style={style}>
      {copied ? copiedLabel : label}
    </Btn>
  );
}
