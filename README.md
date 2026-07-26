# The Archive 2.0 Alpha

This build begins the product redesign requested after the 1.0 prototype.

## Included in this alpha
- Uses the three uploaded maps exactly as supplied:
  - Erilea
  - Prythian
  - Lunathion / Crescent City
- Full-size scrollable Atlas viewer
- Smooth shelf → pulled book → opening cover transition
- New book front-matter page before chapter navigation
- Spoiler-free overview and reading-status controls on every book
- Direct chapter entry, Haven’t Started, Reading, and Finished controls
- Step-by-step first-time setup:
  1. Book Club nickname
  2. First Read or Reread
  3. Every published book, one at a time
- Clearer chapter number / Completed spacing
- Characters and Places tabs inside books
- Archive directories grouped into courts, houses, factions, and regions where seeded
- Honest content-status labels
- Whole-book summary structure
- Existing Google authentication retained

## Content status
This is a functional product alpha, not the completed editorial library.

Currently populated:
- Throne of Glass Chapters 1–8
- Throne of Glass whole-book summary
- Early spoiler-safe character and place entries for selected first books
- Early verified Lore entries

Still in production:
- All remaining chapter summaries
- Complete character and location directories
- Full Lore and Canon audit
- Cross-series Connections
- Chapter artwork beyond the current concept banners
- Supabase cloud tables for shared progress, Book Clubs, mentions, posts, and reactions

## Maps
The uploaded map files are packaged in `assets/maps/`. The app does not redraw or replace them.

## Test
Upload to the GitHub `development` branch and open the permanent Netlify development site or a Deploy Preview.


## UI polish pass
- Fixed unreadable onboarding radio-button text.
- Added strong selected, hover, and keyboard-focus states.
- Improved form contrast and input focus visibility.
- Increased spacing between chapter numbers and status text.
- Standardized button heights and interactions.
- Improved mobile layout and onboarding scrolling.


## Content expansion pass
- Removed chapter artwork from the reading layout.
- Made onboarding fit within one viewport with a compact book-by-book wizard.
- Front-page Characters, Places, and Whole Book buttons now open inline.
- Expanded spoiler-free book overviews.
- Added chapter-based Connection unlocks.
- Expanded character directory and separated it by series.
- Added Throne of Glass chapter summaries for Chapters 9–20.
- Improved Book Club reader/progress spacing.
- Added Global Connect and More to Come premium-preview cards.


## Character and Places contrast fix
- Corrected dark text/background conflicts in Characters and Places.
- Changed inline book panels to parchment styling.
- Improved heading, paragraph, and fine-print contrast.
- Restyled character-name chips as light catalog entries.


## Cloud profile and progress sync
This build connects:
- `profiles`
- `reading_progress`

Synced across devices:
- nickname
- First Read / Reread mode
- onboarding completion
- current chapter for every book
- reading status

On first cloud login, existing local browser progress can be imported.

Still browser-local:
- discussions
- mentions
- reactions
- notes
- quotes

## Archive 2.1 stability and spoiler-safety pass
- Browser caches are isolated by authenticated Google user ID.
- Signing out clears the active in-memory reader state, preventing account crossover.
- "Current chapter" now means the chapter being read; only earlier chapters are completed.
- Chapter recaps stay locked until that chapter is completed.
- Whole-book recaps stay locked until the book is finished or reread mode is enabled.
- Unreviewed character names no longer bypass spoiler protection.
- Cloud operations display real saving, saved, offline, and error states.
- `user_book_settings` now loads and saves reread state and last-opened tabs.
- The SQL migration lives in `supabase/migrations/20260712_user_book_settings.sql`.
- Progress semantics have regression tests in `tests/progress-model.test.js`.

## Archive 2.2 reading-plan pass
- New readers choose Purist, Romantic, or Archivist placement for The Assassin’s Blade; the Throne of Glass shelf follows that choice.
- New readers choose Yes, No, or Unsure for the Empire of Storms / Tower of Dawn tandem read.
- A dedicated Tandem Read spine and 50-step tracker sit between Queen of Shadows and Empire of Storms.
- Completing tandem steps updates both source books automatically.
- Opening the chapter guide always begins at Chapter 1.
- Chapter pages now show one “What you’ll remember” recap instead of duplicate summary panels.
- Whole-book summaries remain on the book overview and were removed from chapter tabs.
- The character catalog now includes substantially more spoiler-gated characters across all three series.
- Lore and Connections gained reviewed canon clues, strong inferences, and clearly labeled fan theories.
- Lunathion was replaced in the Atlas by the supplied Midgard map.
- Supabase is version-pinned with integrity checking and Netlify now sends baseline security headers.
- Complete, reproducible RLS migrations are included for profiles, progress, and book settings.

## Archive 2.3 tandem-book and editorial pass
- Tandem Read now opens and behaves like a normal book instead of a separate checklist dashboard.
- Its 50 reading sections replace chapter numbers with the exact Empire of Storms / Tower of Dawn assignment.
- Tandem sections include What You’ll Remember, Characters, Places, Lore, Connections, and Discussion.
- Completing a section continues updating both original books automatically.
- Readers may turn Tandem Read off or back on without deleting their saved place or either book’s progress.
- The Archive character directory is divided into separate Throne of Glass, ACOTAR, and Crescent City views.
- Character profiles are deduplicated inside each series and remain gated by completed chapters.
- Original Throne of Glass chapter summaries now cover Chapters 1–40.
- Lore and Connections gained additional reviewed artifacts, world-walking concepts, canon crossovers, and clearly marked fan theories.
# Archive 2.6 community setup

Before testing the new community features, run `supabase/archive-community-2.6.sql` in the Supabase SQL Editor.

The following work immediately after that migration:

- all current readers in the Book Club panel;
- Book Club bulletin posts;
- chapter and book-opening/book-ending song recommendations;
- private Supabase Storage uploads for reader art;
- spoiler-gated reader theories;
- meetups and events;
- community “Dear Sarah” letters.

The Archivist and mention emails use Netlify Functions so private keys never appear in browser code. Add these values under Netlify → Site configuration → Environment variables:

- `OPENAI_API_KEY` — enables AI answers;
- `OPENAI_MODEL` — optional, defaults to `gpt-5.4-nano`;
- `SUPABASE_URL` — `https://ikvwfkmyyynyicxqqqlf.supabase.co`;
- `SUPABASE_PUBLISHABLE_KEY` — the existing browser-safe publishable key;
- `SUPABASE_SERVICE_ROLE_KEY` — needed only by the mention-email function; never put it in frontend code;
- `RESEND_API_KEY` — enables mention emails;
- `RESEND_FROM_EMAIL` — a verified sender such as `The Archive <mentions@thechapterarchive.com>`;
- `SITE_URL` — `https://thechapterarchive.com`.

Without an OpenAI key, The Archivist automatically falls back to the local spoiler-safe Archive index. Without Resend configuration, in-site mentions continue to work but the optional email is skipped.

The Archivist verifies the reader’s Supabase progress on every request, sends only unlocked facts to OpenAI, refuses unsupported questions, checks the answer for locked character names, and limits each account to 20 questions per hour. OpenAI keys remain server-side.
