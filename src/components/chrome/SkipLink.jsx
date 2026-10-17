import { useT } from '../../i18n/useT.js';
export function SkipLink() {
  const { t } = useT();
  return (
    <a href="#main-content" className="skip-link">{t('shell.skipToContent')}</a>
  );
}
