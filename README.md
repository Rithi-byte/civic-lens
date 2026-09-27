# CivicLens 🔍

**A centralized civic issue reporting and resolution platform that connects citizens with authorities, making local problems visible, trackable and actionable.**

Built for the VISION2WEB Full Stack Web Development Hackathon.

## Features

| Role | What they can do |
|---|---|
| **Citizen** | Sign up, report an issue with a photo, category, priority and map pin (or GPS), track their reports, upvote ("I face this too"), comment, get notified on every status change |
| **Authority (department officer)** | See a department queue sorted by priority, move issues through the workflow **Reported → Acknowledged → In Progress → Resolved** (or Rejected), notes required when resolving/rejecting |
| **Admin** | City-wide analytics (status, category, 14-day trend, hotspot areas, avg. resolution time), assign officers and change priority, create authority accounts, activate or deactivate users |
| **Public (no login)** | Browse, search and filter all issues, live map, transparency stats |

**Also included:** JWT auth with role-based access, server-side validation (Zod) plus client-side validation, enforced workflow transitions, in-app notifications, full-text search, pagination, a responsive mobile-friendly UI, and auto-seeded demo data.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router, Leaflet (OpenStreetMap), Recharts
- **Backend:** Node.js, Express 5, Mongoose, Zod, JWT, bcrypt
- **Database:** MongoDB (Atlas in production, automatic in-memory DB for local development)
- **Deployment:** A single Render web service (Express serves the built React app)

## Demo accounts (password: `password123`)

| Role | Email |
|---|---|
| Admin | admin@civiclens.in |
| Authority (Roads) | roads@civiclens.in |
| Authority (Water / Electricity / Sanitation / Drainage) | water@ / electricity@ / sanitation@ / drainage@civiclens.in |
| Citizen | citizen@civiclens.in |

The login page has one-click demo buttons.

## Run locally

```bash
npm run install:all
npm install
npm run dev
```

Open http://localhost:5173. The first start downloads a temporary MongoDB (about 1 minute). To use Atlas instead, copy `server/.env.example` to `server/.env` and set `MONGO_URI`.

## Testing

- **API tests:** 53 integration tests (Node test runner + Supertest + in-memory MongoDB)
  ```bash
  npm test
  ```
- **UI tests:** 25 end-to-end tests in real Chrome (Puppeteer), including responsive and axe-core accessibility checks. Start a throwaway server first (`MONGO_URI=` and `PORT=5055`), then:
  ```bash
  npm run test:e2e
  ```

Results and all fixes are documented in `docs/CivicLens_Test_Report.docx`.

## API overview

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET | `/api/auth/me` | Logged in |
| GET | `/api/issues?q=&category=&status=&sort=&page=&mine=&scope=` | Public |
| GET | `/api/issues/map`, `/api/issues/:id`, `/api/issues/:id/image` | Public |
| POST | `/api/issues` | Citizen |
| PATCH | `/api/issues/:id/status` | Authority (own department), Admin |
| PATCH | `/api/issues/:id/assign` | Admin |
| POST | `/api/issues/:id/upvote`, `/api/issues/:id/comments` | Logged in |
| DELETE | `/api/issues/:id` | Owner (while still "Reported"), Admin |
| GET/POST/PATCH | `/api/users` | Admin |
| GET | `/api/stats` | Public (authorities see their department) |
| GET/PATCH | `/api/notifications` | Logged in |

## Project structure

```
server/src
  index.js          Express app, serves client/dist in production
  db.js             MongoDB connection (in-memory fallback for dev)
  seed.js           Demo users and 20 realistic issues
  models/           User, Issue, Notification
  routes/           auth, issues, users, stats, notifications
  middleware/       JWT auth and roles, validation, error handling
client/src
  pages/            Home, Issues, IssueDetail, ReportIssue, MyIssues, AuthorityDashboard, AdminDashboard, Auth
  components/       Navbar, IssueCard, IssueTable, Maps, ui
```
