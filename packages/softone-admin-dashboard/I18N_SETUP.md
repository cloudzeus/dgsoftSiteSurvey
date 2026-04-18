# Multi-Language (i18n) Setup Guide

## Overview
The application now supports Greek (el) and English (en) using **next-intl**.

## Installation

Run the following command to install next-intl:

```bash
npm install next-intl
```

Or with yarn:

```bash
yarn add next-intl
```

## File Structure

```
packages/softone-admin-dashboard/
├── i18n.ts                    # i18n configuration
├── middleware.ts              # i18n middleware for locale routing
├── messages/
│   ├── el.json               # Greek translations
│   └── en.json               # English translations
├── app/
│   ├── layout.tsx            # Updated for i18n
│   ├── [locale]/             # Locale-prefixed routes
│   │   ├── page.tsx
│   │   ├── (dashboard)/
│   │   ├── login/
│   │   └── ...
├── components/
│   └── shared/
│       └── language-switcher.tsx  # Language switcher component
```

## How It Works

1. **Middleware** (`middleware.ts`): Handles locale detection and routing. All requests are prefixed with `/en` or `/el`.

2. **Configuration** (`i18n.ts`): Defines supported locales and loads translation messages.

3. **Messages** (`messages/`): JSON files containing translations for each language.

4. **Layout** (`app/layout.tsx`): Wraps the app with `NextIntlClientProvider` for client-side access to translations.

5. **Language Switcher**: A component that allows users to change the language.

## File Structure Changes Needed

After installing next-intl, you need to move all route files into a `[locale]` directory:

Current structure:
```
app/
├── page.tsx
├── (dashboard)/
├── login/
```

Should become:
```
app/
├── [locale]/
│   ├── page.tsx
│   ├── (dashboard)/
│   ├── login/
```

This allows next-intl to properly prefix all routes with the locale.

## Using Translations in Components

### Server Components
```tsx
import { useTranslations } from 'next-intl'

export default function Page() {
  const t = useTranslations()
  
  return <h1>{t('survey.title')}</h1>
}
```

### Client Components
```tsx
'use client'

import { useTranslations } from 'next-intl'

export default function MyComponent() {
  const t = useTranslations()
  
  return <button>{t('common.save')}</button>
}
```

## Translation Keys

Translations are organized by namespace:

- `common.*` - Common UI elements (buttons, labels)
- `navigation.*` - Navigation items
- `survey.*` - Survey-related text
- `results.*` - Results page text

See `messages/en.json` and `messages/el.json` for complete key listings.

## Adding New Translations

1. Add the new key to both `messages/en.json` and `messages/el.json`
2. Use in components with `t('namespace.key')`

Example:
```json
// messages/en.json
{
  "newFeature": {
    "title": "New Feature Title",
    "description": "Feature description"
  }
}

// messages/el.json
{
  "newFeature": {
    "title": "Τίτλος Νέας Δυνατότητας",
    "description": "Περιγραφή δυνατότητας"
  }
}
```

Then use in components:
```tsx
const t = useTranslations()
t('newFeature.title')
```

## URL Structure

After implementation, URLs will look like:

- Greek: `http://localhost:3000/el/dashboard/site-survey`
- English: `http://localhost:3000/en/dashboard/site-survey`

Default locale is Greek, so:
- `http://localhost:3000/` redirects to `/el/`

## Next Steps

1. **Install next-intl**: `npm install next-intl`
2. **Migrate routes** to use `[locale]` prefix
3. **Update components** to use `useTranslations()` hook
4. **Add language switcher** to your header/layout
5. **Test all languages** in the application

## Deployment Notes

- Translations are static JSON files loaded at build time
- No runtime translation required
- All locales are built and deployed together
