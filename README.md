# HRPulse 2.0 — Attendance system

A rebuilt version of the original HRPulse attendance app. Same stack (MongoDB, Express, React, Vite, Tailwind), new data model, new interface and many more features.

## What was wrong with v1 (review summary)

| Area | Problem in v1 | Fixed in v2 |
|---|---|---|
| Security | `backend/.env` with the live MongoDB URI and JWT secret was inside the project/zip | `.env` is git-ignored, `.env.example` provided. **Rotate your old MongoDB password and JWT secret.** |
| Security | No rate limit on login, no security headers, hard-coded CORS origin, deleted users kept working tokens (`req.user` became `null` and crashed `authorize`) | Login rate limit, Helmet, `CLIENT_URL` env, token checks the user still exists and is active |
| Styling | `src/index.css` was empty, so `@import "tailwindcss"` was missing and Tailwind never loaded | Full design system with light and dark themes |
| Data model | Attendance stored as an ever-growing array inside each user document | Separate `attendances` collection with a unique (user, date) index |
| Dates | "Today" used the server's local time, so a server in another region recorded the wrong day | Company timezone setting (default Asia/Karachi) used for every date and time |
| Code | Three identical dashboard pages; dead `ManagerDashboard.jsx` calling a non-existent `/attendance` route and using `alert()` as a confirm | One shared "My day" page for every role |
| Validation | No checks on role, email format, duplicate email on update (500 error), manager could delete or demote themselves | Validation and clear error messages; last active manager is protected |
| Employees | Could only press sign in/out; no history | Personal calendar, stats, leave and profile |
| Logic | Only weekends counted as holidays; no late detection; "shift completed" window existed only in the browser | Holidays, late arrivals, short days, leave and auto sign-out all handled on the server |

## New features

**Everyone (employee, developer, manager)**
- My day: live clock, one-tap sign in / sign out with optional notes, a timeline of the working day, warning before signing in late, confirmation before signing out
- Last 7 days chart, average day and on-time rate
- My attendance: month calendar coloured by status, day details, list view, CSV download
- My leave: annual / sick / casual / unpaid balances, request leave, cancel pending or upcoming leave
- Profile: edit name and phone, change password
- Notices from the manager and upcoming holidays
- Dark mode, mobile layout

**Managers**
- Team today: who is in right now (aligned timelines), late, on leave, not in; one-click leave approval; department breakdown; 14-day trend chart; recent activity
- Records: today / this week / this month / last month / custom range, filter by person, role or department; month grid for the whole team with per-person totals and attendance rate
- Correct or add attendance for anyone (forgotten sign-out, missed day) with a reason the employee can see
- Export any view to CSV (opens in Excel)
- People: search, filter, add, edit, reset password, deactivate (keeps history) or delete
- Leave requests: approve or decline with a note; approved days show as leave, not absent
- Holidays calendar, Notices board, Activity log of every change
- Settings: company name, timezone, start/end time, grace period, full-day and short-day hours, auto sign-out, weekend days, yearly leave allowance

## Statuses

| Status | Meaning |
|---|---|
| Present | Signed in before start time + grace period |
| Late | Signed in after start time + grace period |
| Short day | Signed out after working less than the "short day" hours |
| On leave | Approved leave covers the day |
| Holiday / Weekend | Company holiday or configured weekend day |
| Absent | A past working day with no sign-in and no leave |
| Not in yet | Today, not signed in yet |

Days before a person's joining date are not counted as absent.

## Setup

Requirements: Node.js 20+ and MongoDB (local or Atlas).

Run everything from the main `hrpulse` folder:

```bash
npm install            # installs backend and frontend packages too
npm run setup          # creates backend/.env and frontend/.env (with a random JWT secret)
# open backend/.env and set MONGO_URI if you're not using a local MongoDB
npm run seed:demo      # manager@test.com / 123456 + sample people and history
                       # (or: npm run seed  for the manager account only)
npm run dev            # starts the API (port 5005) and the web app together
```

Open the address shown after `[web] Local:` (usually http://localhost:5173).

Other commands from the main folder: `npm run reset-manager`, `npm run migrate`, `npm run build`.

You can still run each part on its own with `npm run dev` inside `backend` or `frontend`.

Change the default manager password from the Profile page after the first sign-in.

### Common problems

| Message | Fix |
|---|---|
| `Cannot find module 'dotenv'` (or any module) | Run `npm install` in that folder (`backend` and `frontend` each need it once). |
| "Cannot reach the server" on the sign-in page | The API isn't running. Start it with `npm run dev` in `backend` and check http://localhost:5005/api/health. Any `localhost` port is allowed, so it doesn't matter if Vite opens on 5174 or 5176. |
| "Email or password is incorrect" for the manager | Run `npm run reset-manager` in `backend`. It creates `manager@test.com` / `123456`, or resets the password if the account exists. For your own account: `npm run reset-manager -- you@company.com newPassword`. |
| MongoDB connection error | Check `MONGO_URI` in `backend/.env` and that MongoDB is running (or your Atlas IP allow-list). |

### Demo login box

The sign-in page shows a "Demo login" box with the manager's email and password and a one-click "Sign in as manager" button. Configure it in `frontend/.env`:

```
VITE_DEMO_LOGIN=true            # false hides the box (use this for a real company)
VITE_DEMO_EMAIL=manager@test.com
VITE_DEMO_PASSWORD=123456
```

Restart `npm run dev` in `frontend` after changing `.env`. Anyone who opens the page can sign in as manager, so keep only demo data in a database used this way.

### Upgrading from v1 with existing data

Point `MONGO_URI` at your existing database, then run once:

```bash
cd backend
npm run migrate
```

It copies every `users[].attendance[]` entry into the new `attendances` collection, works out late minutes using the current settings, and removes the old arrays. It is safe to run more than once. Existing logins and passwords keep working. Old URLs (`/employee`, `/developer`, `/manager/...`) redirect to the new pages.

## Deploy to Vercel

The project deploys as one Vercel project with two services (see `vercel.json`): the Express API under `/api` and the Vite app for everything else, on the same domain.

1. **Create a MongoDB Atlas database.** `localhost` does not exist on Vercel. In Atlas, under *Network Access*, add `0.0.0.0/0` (Vercel's IPs change), and copy the connection string, for example
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/hrpulse?retryWrites=true&w=majority`.
2. **Create the manager in that database** from your computer: put the Atlas string in `backend/.env` as `MONGO_URI`, then run `npm run seed:demo` (or `npm run reset-manager`).
3. **Push the project to GitHub** and import it in Vercel. Leave the root directory as the main `hrpulse` folder; `vercel.json` tells Vercel about both services.
4. **Add environment variables** in Vercel (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | a long random string |
   | `VITE_DEMO_LOGIN` | `true` or `false` (optional) |
   | `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD` | optional, shown in the demo box |

   Do **not** set `VITE_API_URL`; the app calls `/api` on its own domain.
5. **Deploy**, then open `https://<your-app>.vercel.app/api/health`. It should show `"configured": true`. If it shows `false`, an environment variable is missing; redeploy after adding it.

On Vercel the API runs as a serverless function, so the 10-minute auto sign-out timer doesn't run. Forgotten sessions are closed the next time anyone loads the app instead.

## API overview

All routes are under `/api`. Send `Authorization: Bearer <token>`.

| Method | Route | Who |
|---|---|---|
| POST | `/auth/login` | public |
| GET/PUT | `/auth/me`, PUT `/auth/password` | signed in |
| POST | `/attendance/signin`, `/attendance/signout` | signed in |
| GET | `/attendance/status`, `/attendance/me?month=YYYY-MM` | signed in |
| GET | `/attendance/records?start&end&employeeId&role&department` | manager |
| GET | `/attendance/export?...` (CSV) | manager |
| POST / DELETE | `/attendance/manual`, `/attendance/:id` | manager |
| GET | `/dashboard` | manager |
| GET/POST/PUT/PATCH/DELETE | `/users`, `/users/:id`, `/users/:id/active`, `/users/departments` | manager |
| GET/POST/PATCH | `/leaves/mine`, `/leaves`, `/leaves/:id/cancel` | signed in |
| GET/PATCH | `/leaves`, `/leaves/:id/review`, `/leaves/balance/:userId` | manager |
| GET / POST / DELETE | `/holidays` | read: all, write: manager |
| GET/PUT | `/settings` | manager |
| GET / POST / DELETE | `/announcements` | read: all, write: manager |
| GET | `/audit` | manager |

## Project layout

```
backend/
  models/        User, Attendance, Leave, Holiday, Announcement, AuditLog, Settings
  controllers/   auth, users, attendance, leave, dashboard, misc (holidays, settings, notices, audit)
  utils/         timezone helpers, day-status rules, auto sign-out, audit logger
  scripts/       seed.js, migrateV1.js
frontend/src/
  pages/         MyDay, MyHistory, MyLeave, Profile, Login
  pages/team/    Overview, Records, People, LeaveRequests, Holidays, Notices, Activity, Settings
  components/    Layout, DayRuler, MonthCalendar, TrendChart, AttendanceEditor, ui kit
```
