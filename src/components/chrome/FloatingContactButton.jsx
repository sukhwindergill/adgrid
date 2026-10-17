import { IconChat } from '../icons.jsx';
import { useT } from '../../i18n/useT.js';

export function FloatingContactButton({ onClick }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className="floating-contact-btn"
      onClick={onClick}
    >
      <IconChat size={16} /> {t('shell.contactUs')}
    </button>
  );
}
