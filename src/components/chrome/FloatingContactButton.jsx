import { IconChat } from '../icons.jsx';

export function FloatingContactButton({ onClick }) {
  return (
    <button
      type="button"
      className="floating-contact-btn"
      onClick={onClick}
    >
      <IconChat size={16} /> Contact us
    </button>
  );
}
