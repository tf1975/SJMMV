# The Archive 1.0 Foundation

A functional, data-driven production foundation for an expandable spoiler-safe reading platform.

Included: immersive library, official release countdowns, all SJM books, TOG set to 55 chapters, local profiles, progress, chapter locks, discussions, @mentions, maps, Reread Mode, granular Lore/Connection unlock logic, and original summary/artwork seeds for Throne of Glass Chapters 1–8.

Upload these files into the existing GitHub repository and push. Netlify will update the live site automatically.

## Google authentication test
This build connects to Supabase Auth and includes:
- Continue with Google
- Session restoration after refresh
- Signed-in state
- Sign out

Before testing, confirm your Supabase Authentication URL Configuration includes the exact Netlify production URL, and the same Netlify origin is present in Google Cloud as an Authorized JavaScript origin.
