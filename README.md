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
