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
