# AdGrid Operator (mobile)

Expo/React Native app for screen operators — approvals, screens, revenue, on-the-go.

## Local development

```bash
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start              # scan the QR with Expo Go on a phone on the same Wi-Fi
```

`.env` is git-ignored on purpose (Metro auto-inlines `EXPO_PUBLIC_*` vars into the bundle at build
time — nothing else reads it). This is enough for Expo Go / `expo start --dev-client` on your own
machine. It is **not** enough to produce a real installable build — see below.

## Producing a real build (required before this has ever run on a device)

No EAS project has been created for this app yet — `eas.json`'s build profiles exist
([mobile/eas.json](eas.json)) but nothing has run `eas init` against a real EAS account. Until
this is done:

- **`preview`/`production` EAS builds will ship broken.** EAS Build uploads your project
  respecting `.gitignore`, so the git-ignored `.env` never reaches the cloud build — and
  `eas.json` has no `env` block configured as a substitute. The app boots with
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` both `undefined`, so
  `createClient(undefined, undefined, …)` — every screen fails from first launch, silently.
- **Push notifications will never register.** `getExpoPushTokenAsync()` requires
  `extra.eas.projectId` in the app config, which `eas init` writes. Without it, registration
  throws (caught — the app doesn't crash, in-app notifications still work) and no operator ever
  receives a push. Console shows `Push notifications disabled: no EAS project is linked…` when
  this happens.

### One-time setup

```bash
cd mobile
npx eas login                 # your Expo/EAS account
npx eas init                  # links this project, writes extra.eas.projectId into app config

# Set the two Supabase vars for the profiles that actually get installed —
# NOT into eas.json (that's committed to the repo; these are secrets/config
# that shouldn't be, even though the anon key itself is a public-safe key).
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value <your-supabase-url> --environment preview,production
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <your-anon-key> --environment preview,production
```

### Build + install on a real device

```bash
npx eas build --profile preview --platform android   # produces an installable APK
# or --profile production for an app-bundle / store submission
```

`development` profile builds (or `expo start --dev-client`) don't need the EAS env vars above —
they pull from your local `.env` via Metro same as `expo start` does. It's specifically the
standalone `preview`/`production` builds that need the EAS-side config.

## Testing

```bash
npm test   # Jest + React Native Testing Library, Supabase/Expo modules mocked (see __mocks__/)
```

Jest mocks the entire Supabase client and native Expo modules — it verifies app logic against a
fake backend, not against a real build. It has never caught (and can't catch) the build-pipeline
gap described above; only an actual `eas build` + install exercises that.
