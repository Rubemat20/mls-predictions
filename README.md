# MLS Playoff Chances

A live playoff-probability dashboard for MLS's Eastern and Western Conferences.
Standings, results, and the remaining schedule are pulled from ESPN on every
request (server-cached for 5 minutes); three independent models then project
each team's rest-of-season outlook.

## Models

- **Points Pace** — extrapolates each team's current home/away points-per-game
  across its remaining fixtures into a projected final total, with an
  approximate playoff probability from a normal approximation around the
  conference's projected cutoff.
- **Monte Carlo** — simulates the rest of the season 8,000 times using a
  current-form power rating (from points-per-game and goal differential) and
  each team's own home-win rate (shrunk toward the league average for small
  samples).
- **Elo Rating** — replays every completed match chronologically (with a
  home-field adjustment and a margin-of-victory multiplier) into a per-team
  Elo rating, then runs the same Monte Carlo engine using Elo-implied win
  probabilities.

Draw probability in both simulations is derived from the league's actual draw
rate this season, tapering as the rating gap between two teams widens.

The playoff line shown in the table (top 9 per conference, top 7 direct to
Round One, 8–9 to the Wild Card round) reflects **today's actual standings**,
not a projection — only the probability/projected-points columns change with
the selected model.

## Data source

[ESPN's public soccer API](https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/)
(standings + full-season scoreboard). No API key required. This is an
unofficial endpoint; if ESPN changes its response shape, `src/lib/espn.ts` is
the only file that needs updating.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

- `src/lib/espn.ts` — fetches standings + full schedule from ESPN
- `src/lib/elo.ts`, `src/lib/strength.ts` — the two rating systems
- `src/lib/probability.ts` — rating differential → win/draw/loss probabilities
- `src/lib/simulate.ts` — the Monte Carlo engine (shared by the Monte Carlo and Elo models)
- `src/lib/pace.ts` — the points-pace projection engine
- `src/lib/compute.ts` — orchestrates the above into one payload
- `src/app/api/data/route.ts` — serves the payload, cached in-memory for 5 minutes
- `src/components/` — the dashboard UI (React + Recharts)

## Deploy to Vercel

```bash
npx vercel
```

Follow the CLI prompts to log in and link the project, then `npx vercel --prod`
to ship. No environment variables are required.
