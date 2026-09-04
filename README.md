# Our Cinema

Private mobile-first cinema app for two people.

## Features
- Up to 9 available movies
- Manual choice
- Random Pick
- Admin page for poster upload and title entry
- Supabase database + Storage
- Delete movies
- PWA manifest

## Supabase setup
Table `movies`:
- id
- created_at
- title
- poster_url
- status

Storage bucket:
- `posters` (public)

Vercel env vars:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
