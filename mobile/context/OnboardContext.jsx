import { createContext, useContext, useState } from 'react';

const OnboardContext = createContext({});

const INITIAL = {
  name: '', venue_category: '', venue_subtype: '',
  address_street: '', address_city: '', address_state: '', address_country: 'CA',
  operating_hours_start: '08:00', operating_hours_end: '22:00',
  timezone: 'America/Toronto', photos: [], screenId: null,
};

export function OnboardProvider({ children }) {
  const [form, setForm] = useState(INITIAL);
  function update(fields) { setForm(prev => ({ ...prev, ...fields })); }
  function reset() { setForm(INITIAL); }
  return (
    <OnboardContext.Provider value={{ form, update, reset }}>
      {children}
    </OnboardContext.Provider>
  );
}

export const useOnboard = () => useContext(OnboardContext);
