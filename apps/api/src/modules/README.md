# API module boundaries

The MVP modules are `identity`, `businesses`, `marketing`, and `content`. Identity owns sessions, recovery, and invitations. Businesses owns membership and brand context. Marketing owns strategy briefs and AI generation. Content owns drafts, reviews, campaigns, and the calendar. Shared policy and validation helpers live in `common`; external providers live behind interfaces in `infrastructure`.
