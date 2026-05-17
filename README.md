# VoteYourHero

A responsive web MVP for event-based hero voting.

## What it does

- Lets a user submit one post with exactly two photos or videos and a description.
- Shows all posts in a public voting feed.
- Allows one vote per browser voter ID for the event.
- Keeps vote counts hidden while voting is open.
- Announces the winner and final leaderboard after the event ends.
- Includes demo controls to end, reopen, or reset the event.

This prototype stores data in browser `localStorage` so it can run without a
backend. A production app should move votes, users, and media to a backend with
authenticated voters, object storage, and a unique database rule for one vote per
event per user.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
