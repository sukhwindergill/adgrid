export function FloatingContactButton({ onClick }) {
  return (
    <button
      type="button"
      className="floating-contact-btn"
      onClick={onClick}
    >
      <span aria-hidden="true">💬</span> Contact us
    </button>
  );
}
