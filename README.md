# ⚽ World Cup Predictor

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

### A modern FIFA World Cup 2026 prediction platform built for fans.

**🌎 Live Demo:** https://fifa-world-cup-predictor-jet.vercel.app/

</div>

---

## Overview

The **FIFA World Cup Predictor** is an interactive web application that allows fans to simulate the entire FIFA World Cup 2026 tournament—from the group stage all the way to the Final.

Instead of simply filling out a static bracket, users can explore different tournament scenarios, predict match results, automatically generate knockout rounds, and visualize how every decision impacts the tournament.

The project was built to combine a polished user experience with the complexity of FIFA's new 48-team tournament format.

---

## Why I Built It

As both a lifelong football fan and someone working professionally on the FIFA World Cup 2026, I wanted to create the tournament predictor I always wished existed.

Most prediction tools are little more than printable brackets.

I wanted something that felt like a modern web application:

- Fast
- Beautiful
- Interactive
- Responsive
- Fun to explore

This project became an opportunity to challenge myself with complex frontend state management while designing an interface that makes a tournament with over 100 matches feel intuitive.

---

# Features

### 🏆 Complete Tournament Simulation

Predict every match from kickoff to the Final.

---

### 🌍 Full FIFA World Cup 2026 Format

Supports the expanded 48-team World Cup structure.

---

### ⚽ Dynamic Knockout Bracket

The knockout stage automatically updates based on your predictions.

---

### 📊 Automatic Standings

Group tables update instantly with:

- Points
- Goal Difference
- Goals Scored
- Qualification Positions

---

### 🔄 Live Tournament Progression

Every prediction affects the next stage of the competition.

No manual bracket editing required.

---

### 📱 Responsive Design

Optimized for desktop, tablet and mobile devices.

---

### ✨ Modern User Experience

- Smooth animations
- Clean layouts
- Fast navigation
- Accessible design
- Mobile-first interface

---

# Screenshots

> Replace these placeholders with actual screenshots.

| Home | Groups |
|-------|--------|
| ![](docs/home.png) | ![](docs/groups.png) |

| Knockout | Prediction |
|-----------|------------|
| ![](docs/bracket.png) | ![](docs/prediction.png) |

---

# Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## UI

- shadcn/ui
- Framer Motion
- Lucide Icons

## Development

- ESLint
- Vercel

---

# Project Structure

```
src/
│
├── app/
├── components/
├── hooks/
├── lib/
├── data/
├── types/
├── utils/
└── styles/
```

---

# Engineering Challenges

Building a realistic World Cup predictor required solving several interesting frontend problems:

### Tournament State Management

Every match affects future fixtures.

Updating one prediction can cascade through the entire knockout stage, requiring dependent matches to update automatically.

---

### Expanded 48-Team Format

The FIFA World Cup 2026 introduces a completely new tournament structure.

Supporting this format meant modeling qualification rules, group standings, and knockout progression in a scalable way.

---

### Dynamic Standings

Group tables update instantly based on every score prediction while applying FIFA tiebreakers.

---

### Responsive Information Density

Displaying dozens of matches, standings, and brackets without overwhelming the user required careful layout and UI design.

---

# Local Development

Clone the repository

```bash
git clone https://github.com/raf0x/FIFA-World-Cup-Predictor.git
```

Install dependencies

```bash
npm install
```

Run locally

```bash
npm run dev
```

Visit

```
http://localhost:3000
```

---

# Future Improvements

Planned features include:

- 🤖 AI-powered match predictions
- 📈 Team strength and Elo ratings
- 🌎 Multiple tournament presets
- 👤 User accounts
- ☁️ Cloud saved predictions
- 🔗 Shareable brackets
- 🏅 Community prediction leaderboard
- 📊 Tournament statistics dashboard
- 📱 Progressive Web App (PWA)
- 🌙 Additional themes

---

# Lessons Learned

This project pushed me to improve in several areas, including:

- Complex React state management
- Component architecture
- TypeScript modeling
- Responsive UI design
- Performance optimization
- Large-scale frontend organization
- Building intuitive user experiences for data-heavy applications

---

# Contributing

Contributions, ideas, and feature suggestions are always welcome.

If you'd like to improve the project:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a Pull Request

---

# License

This project is released under the MIT License.

---

# Author

**Rafael Lemor**

Frontend Developer • Product Designer • Football Enthusiast

If you enjoyed this project, feel free to ⭐ the repository.

---

> **Disclaimer**
>
> This is an independent fan-made project and is **not affiliated with or endorsed by FIFA**. FIFA and FIFA World Cup are trademarks of the Fédération Internationale de Football Association.
