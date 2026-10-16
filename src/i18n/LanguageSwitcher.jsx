import { useT } from './useT.js';

// Canada.ca-style toggle: one button naming the *other* language, written in
// that language, so a reader who can't read the current page still finds it.
export function LanguageSwitcher({ className = '', style }) {
  const { t, locale, setLocale } = useT();
  const next = locale === 'fr-CA' ? 'en' : 'fr-CA';
  return (
    <button
      type="button"
      className={className}
      style={style}
      lang={next === 'fr-CA' ? 'fr' : 'en'}
      aria-label={t('common.language.switchTo')}
      onClick={() => setLocale(next)}
    >
      {t('common.language.other')}
    </button>
  );
}
