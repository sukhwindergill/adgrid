import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { t, setLocale, getLocale, detectLocale, LOCALE_STORAGE_KEY } from './core.js';
import { formatCurrency, formatMoney, formatNumber, formatPercent, formatDate } from './format.js';
import { rich } from './useT.js';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import { Nav } from '../views/marketing/sections/Nav.jsx';

// Intl puts narrow no-break spaces in French numbers; compare on plain spaces.
const NBSP = new RegExp('[' + String.fromCharCode(0xa0, 0x202f) + ']', 'g');
const plain = s => s.replace(NBSP, ' ');

describe('t()', () => {
  it('interpolates variables', () => {
    expect(t('invite.operator.passwordTooShort', null, 'en')).toBe('Password must be at least 8 characters.');
    expect(t('dash.welcomeName', { name: 'Sam' }, 'en')).toBe('Welcome back, Sam');
    expect(t('dash.welcomeName', { name: 'Sam' }, 'fr-CA')).toBe('Bon retour, Sam');
  });

  it('picks plural forms with each language\'s rules', () => {
    expect(t('common.screensCount', { count: 1 }, 'en')).toBe('1 screen');
    expect(t('common.screensCount', { count: 2 }, 'en')).toBe('2 screens');
    // French treats 0 and 1 as singular.
    expect(t('common.screensCount', { count: 0 }, 'fr-CA')).toBe('0 écran');
    expect(t('common.screensCount', { count: 1 }, 'fr-CA')).toBe('1 écran');
    expect(t('common.screensCount', { count: 2 }, 'fr-CA')).toBe('2 écrans');
  });

  it('formats numeric variables for the locale', () => {
    expect(t('common.screensCount', { count: 1500 }, 'en')).toBe('1,500 screens');
    expect(plain(t('common.screensCount', { count: 1500 }, 'fr-CA'))).toBe('1 500 écrans');
  });

  it('returns the key itself when no catalog has it', () => {
    expect(t('nope.not.here', null, 'fr-CA')).toBe('nope.not.here');
  });
});

describe('formatting helpers', () => {
  it('formats CAD the Canadian way in each language', () => {
    expect(formatCurrency(1234.56, undefined, 'en')).toBe('$1,234.56');
    expect(plain(formatCurrency(1234.56, undefined, 'fr-CA'))).toBe('1 234,56 $');
    expect(plain(formatMoney(30, 'cad', 'fr-CA'))).toBe('30,00 $ CAD');
    expect(formatMoney(30, 'cad', 'en')).toBe('$30.00 CAD');
  });

  it('formats numbers, percents and dates', () => {
    expect(plain(formatNumber(1234567.5, undefined, 'fr-CA'))).toBe('1 234 567,5');
    expect(plain(formatPercent(0.7, undefined, 'fr-CA'))).toBe('70 %');
    expect(formatDate('2026-10-01', { dateStyle: 'long' }, 'en')).toBe('October 1, 2026');
    expect(formatDate('2026-10-01', { dateStyle: 'long' }, 'fr-CA')).toBe('1 octobre 2026');
  });
});

describe('rich()', () => {
  it('swaps tags and node variables for React nodes', () => {
    render(<p>{rich('Read the <a>terms</a>, {name}.', { a: chunk => <a href="/terms">{chunk}</a>, name: <b>Sam</b> })}</p>);
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByText('Sam').tagName).toBe('B');
  });
});

describe('locale detection and switching', () => {
  const originalLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => {
    if (originalLanguages) Object.defineProperty(window.navigator, 'languages', originalLanguages);
    else delete window.navigator.languages;
    setLocale('en', { persist: false });
    window.localStorage.clear();
  });

  it('uses the browser language when nothing is saved', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'en']);
    expect(detectLocale()).toBe('fr-CA');
    vi.restoreAllMocks();
  });

  it('prefers a saved choice over the browser language', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-CA']);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    expect(detectLocale()).toBe('en');
    vi.restoreAllMocks();
  });

  it('the switcher flips the language, saves it and sets <html lang>', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le site en français' }));
    expect(getLocale()).toBe('fr-CA');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr-CA');
    expect(document.documentElement.lang).toBe('fr-CA');
    expect(screen.getByRole('button', { name: 'View the site in English' })).toHaveTextContent('English');
  });

  it('re-renders translated components on switch', () => {
    render(<MemoryRouter><Nav onScrollTo={() => {}} onLogin={() => {}} onSignup={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    act(() => setLocale('fr-CA'));
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
    expect(screen.getByText('Commencer')).toBeInTheDocument();
  });
});
