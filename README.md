# The Archive — Onboarding, Reread, Maps & Summaries Update

## Included
- Returning-reader versus new-reader entry choice
- Google authentication preserved
- First-time onboarding after Google sign-in
- Direct chapter number entry; entering Chapter 38 marks earlier chapters complete
- Mark-book-finished controls
- First Read and real Reread profile modes
- Reread insight area for seeded chapters
- Whole-book summary and “What Changed” section for Throne of Glass
- Actual lightweight original chapter banner art for TOG Chapters 1–8
- Actual original schematic maps for Erilea, Prythian, and Midgard
- Always-open maps with progress-aware location details
- Lore audit: removed the fake generic crossover placeholder and added evidence-backed early TOG lore
- Connections explicitly show that verified connection content has not yet been populated

## Important current limitation
Google authentication is live, but profile progress, discussions, posts, and mentions still persist in browser storage. The next Supabase database step is required for cross-device synchronization.

## Testing
Upload to the development branch first. Test both entry choices, onboarding, direct chapter entry, Reread Mode, chapter art, map buttons, book summary, and lore unlocks before merging into main.


## Visibility correction
This build makes the previously hidden features obvious:
- A homepage “Update books & chapters” button opens onboarding at any time.
- A labeled First Read/Reread control replaces the ambiguous arrow-only experience.
- Whole-book summaries use a “Whole Book” tab.
- Atlas and Archive cards have visible action buttons.
- Chapter art clearly distinguishes completed artwork from in-production placeholders.
- Fixed chapter-list styling.
