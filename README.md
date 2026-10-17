# World Cup Tracker / Predictor

**An independent 2026 World Cup tournament tracker and prediction project.**

I built this project to make the expanded 48-team World Cup format easier to follow, from group fixtures and standings to the knockout bracket. It combines my interest in football with my experience in major-event ticketing operations.

[Explore the project](https://fifa-world-cup-predictor-jet.vercel.app/) · [Read the overview on rlemor.com](https://rlemor.com/projects#world-cup-tracker)

![Historical screenshot of the World Cup Tracker interface](https://rlemor.com/projects/world-cup-tracker/historical-tournament.png)

*Historical interface capture from the independent project. Any tournament status shown in the image reflects the time of capture, not a claim that matches are still live.*

## The challenge

The 2026 tournament expanded to 48 teams and 104 matches. The goal was to bring a complex schedule, group-stage standings, and knockout progression into one interface that was useful to browse and experiment with.

## What the project explores

- **Tournament schedule:** fixtures and match information in a navigable interface.
- **Group-stage standings:** tables that respond to match results and the applicable ranking logic.
- **Knockout bracket:** progression through elimination rounds, with dependencies between outcomes.
- **Prediction scenarios:** an opportunity to explore how changes to results affect later stages.
- **Information density:** a responsive layout for a large tournament without requiring separate spreadsheets or static printable brackets.

The 2026 tournament has concluded, so the project is now presented as a **historical reference and independent product experiment**, not a live-event service.

## Implementation

This repository uses Next.js 15, React 19, JavaScript, and Tailwind CSS. Its application pages live under `app/`, with tournament and schedule logic under `lib/`.

## Run locally

Requires Node.js and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build
npm run start
```

## About

Built by **Rafael Lemor**, a football fan with professional experience in global tournament ticketing and commercial-partner operations.

[Explore more independent projects](https://rlemor.com/projects)

## Independence notice

This is an independent, unofficial project. It is **not affiliated with or endorsed by FIFA**. FIFA and FIFA World Cup are trademarks of their respective owner.
