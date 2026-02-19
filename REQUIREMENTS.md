# Campus360 — How to Set Up & Run This Project

> **What is this?** Campus360 is a university social platform with real-time chat, a forum, club events, and a lost & found section. This guide walks you through setting it up on your Windows computer, step by step. No prior experience needed!

---

## What You Need to Install (Before Anything Else)

You need **two things** installed on your computer:

### 1. WampServer (gives you Apache + PHP + MySQL)

**What is it?** WAMP bundles three tools together so you don't have to install them separately:

- **Apache** = a web server that serves your HTML/CSS/JS files (like a local version of the internet)
- **PHP** = the language our backend code is written in (handles login, chat, forum logic)
- **MySQL** = a database that stores users, messages, posts, etc.

📥 **Download:** <https://www.wampserver.com/en/>

- Run the installer, click **Next** on everything (default settings are fine)
- When it's done, launch WampServer from the Start Menu
- Look at the **bottom-right tray** (near the clock) — you'll see a small icon
- Wait until the icon turns **GREEN** ✅ (green = everything is running)
- If it's **orange** 🟠 or **red** 🔴, something went wrong — see [Troubleshooting](#common-problems--how-to-fix-them)

**Quick test:** Open your browser and go to `http://localhost/` — if you see the WAMP welcome page, you're good!

### 2. Node.js (needed for real-time chat)

**What is it?** Node.js lets us run JavaScript on the server (not just in the browser). We use it for the WebSocket server that makes chat messages appear instantly without refreshing the page.

📥 **Download:** <https://nodejs.org/> (pick the **LTS** version — it's the stable one)

- Run the installer, click **Next** on everything
- It also installs **npm** (a tool to install JavaScript packages) automatically

**Quick test:** Open PowerShell or Command Prompt and type:

```bash
node --version
```

If you see a version number like `v20.11.0`, you're good!

---

---

## Technology Stack

The project is built using:

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: PHP (for API & business logic), Node.js (for WebSocket chat)
- **Database**: MySQL
- **Server**: WampServer (Apache + MySQL + PHP)

---

## Step 1: Put the Project in the Right Place

WAMP only serves files from its `www` folder. Your project needs to be accessible there.

### Option A: Create a Shortcut (Recommended — keeps your files where they are)

1. Open **PowerShell as Administrator** (right-click PowerShell → "Run as administrator")
2. Run this command (change the second path to wherever YOUR project folder is):

```powershell
cmd /c mklink /J "C:\wamp64\www\campus360-redo" "D:\Coding files\Extras\campus360-redo"
```

This creates a "shortcut" (called a symlink) so WAMP can find your files.

### Option B: Just Copy the Folder

Copy your entire `campus360-redo` folder into `C:\wamp64\www\` so it looks like:

```text
C:\wamp64\www\campus360-redo\
```

### Check if It Worked

Open your browser and go to: `http://localhost/campus360-redo/`

You should see the login page. If you see a "404 Not Found" error, the folder isn't in the right place.

---

## Step 2: Create the Database

The app stores all its data (users, messages, posts) in a MySQL database. You need to create it.

### How to Do It

1. Open your browser and go to: `http://localhost/phpmyadmin/`
2. **Username:** `root`
3. **Password:** _(leave it blank — just click "Go")_

Now you need to run **two** SQL files, **in this order**:

### File 1: `database.sql` (creates the main tables)

1. Click the **SQL** tab at the top of phpMyAdmin
2. Open the file `database.sql` from your project folder in a text editor (like Notepad)
3. **Select all** the text (Ctrl+A), **copy it** (Ctrl+C)
4. **Paste it** (Ctrl+V) into the SQL text box in phpMyAdmin
5. Click the **Go** button

This creates the database called `campus360` with tables for users, chat messages, etc.

### File 2: `database_forum.sql` (creates the forum tables)

1. Do the same thing BUT with the file `database_forum.sql`
2. Click the **SQL** tab, paste the contents, click **Go**

> ⚠️ **You MUST run `database.sql` first, then `database_forum.sql` second.** The forum tables depend on the user table created by the first file.

### File 3: `database_events.sql` (creates events tables)

1. Do the same thing with `database_events.sql`
2. Click the **SQL** tab, paste the contents, click **Go**

### File 4: `database_lostfound.sql` (creates lost & found tables)

1. Do the same for `database_lostfound.sql`
2. Click the **SQL** tab, paste the contents, click **Go**

### Verify Database Creation

In phpMyAdmin, click on the `campus360` database on the left sidebar. You should see **9 tables**:

| Table                  | What It Stores                           |
| ---------------------- | ---------------------------------------- |
| `users`                | User accounts (name, email, password)    |
| `chat_invites`         | When someone sends you a chat request    |
| `conversations`        | Each chat conversation (1-on-1 or group) |
| `conversation_members` | Who is in each conversation              |
| `messages`             | All chat messages                        |
| `follows`              | Who follows whom on the forum            |
| `posts`                | Forum posts                              |
| `post_likes`           | Likes on forum posts                     |
| `post_comments`        | Comments on forum posts                  |
| `club_profiles`        | Extra info for club accounts             |
| `events`               | Club events                              |
| `event_rsvps`          | Who is attending events                  |
| `club_follows`         | Who follows which club                   |
| `lost_found_items`     | Items reported lost or found             |

If you see all 14 tables, the database is ready! ✅

If you see all 9, the database is ready! ✅

---

## Step 3: Install Chat Dependencies

The real-time chat uses two small JavaScript packages. You need to install them.

1. Open **PowerShell** or **Command Prompt**
2. Navigate to your project folder:

```powershell
cd "D:\Coding files\Extras\campus360-redo"
```

(change the path to wherever your project folder is)

1. Run:

```bash
npm install
```

This reads the `package.json` file and installs:

- **`ws`** — makes the WebSocket server work (real-time messaging)
- **`mysql2`** — lets the WebSocket server talk to the database

You'll see a `node_modules` folder appear — that's normal, don't delete it!

---

## Step 4: Start Everything

You need **TWO things running at the same time** for the app to fully work:

### Thing 1: WAMP Server

1. Launch WampServer from the Start Menu (if it's not already running)
2. Wait for the tray icon to turn **green** ✅

This gives you:

- Apache on **port 80** (serves your web pages)
- MySQL on **port 3306** (stores your data)

### Thing 2: The WebSocket Server

1. Open **PowerShell** or **Command Prompt**
2. Navigate to your project folder:

```powershell
cd "D:\Coding files\Extras\campus360-redo"
```

1. Run:

```bash
npm start
```

You should see:

```text
[DB] Connected to MySQL
[WS] WebSocket server running on ws://localhost:8082
```

**Keep this window open!** If you close it, real-time chat stops working (messages will still save, but they won't appear instantly — you'd have to refresh the page).

### Open the App

Go to: <http://localhost/campus360-redo/>

That's it! You should see the login page. Create an account and start using it! 🎉

---

## What Each File Does (Project Structure)

```text
campus360-redo/
│
├── 📄 index.html           ← Home / landing page
├── 📄 login.html           ← Login & signup page
├── 📄 messages.html        ← Chat interface (send/receive messages)
├── 📄 chat.html            ← Chat invites & conversation management
├── 📄 forum.html           ← Social forum (posts, likes, comments, follow)
├── 📄 events.html          ← Club events & directory
├── 📄 lost_found.html      ← Lost & Found reporting
├── 📄 styles.css            ← Global styles
├── 📄 script.js             ← Shared utility scripts
│
├── 📁 js/                   ← JavaScript files (client-side logic)
│   ├── auth.js              ← Handles login/signup/session checks
│   ├── chat.js              ← Chat invite & conversation logic
│   ├── messages.js          ← Real-time messaging (connects to WebSocket)
│   ├── forum.js             ← Forum posts, likes, comments, follows
│   ├── events.js            ← Event listing, creation, filtering
│   ├── lost_found.js        ← Lost & found reporting and browsing
│
├── 📁 php/                  ← PHP files (server-side logic / APIs)
│   ├── config.php           ← Database connection settings
│   ├── auth.php             ← Login, signup, logout, session check
│   ├── chat.php             ← Send/receive messages, manage conversations
│   ├── forum_api.php        ← Create posts, like, comment, follow
│   ├── upload.php           ← Handle file uploads (images, videos, audio)
│   ├── events_api.php       ← Create/manage events, RSVPs, club profiles
│   ├── lost_found_api.php   ← Report lost/found items, resolve them
│
├── 📄 ws-server.js          ← WebSocket server (real-time chat delivery)
├── 📄 package.json          ← Lists the Node.js packages needed
│
├── 📄 database.sql          ← SQL to create main database tables (run FIRST)
├── 📄 database_forum.sql    ← SQL to create forum tables (run SECOND)
├── 📄 database_events.sql   ← SQL to create event tables (run THIRD)
├── 📄 database_lostfound.sql ← SQL to create lost & found tables (run FOURTH)
│
└── 📁 uploads/              ← Where uploaded images/videos/audio go
    ├── image/
    ├── video/
    └── audio/
```

---

## How the App Works (Simple Explanation)

```text
  YOU (Browser)
      │
      ├──── HTTP requests ────→  Apache + PHP (WAMP)  ←──→  MySQL Database
      │     (login, send msg,       (port 80)                (port 3306)
      │      create post, etc.)
      │
      └──── WebSocket ────→  Node.js Server
            (instant chat)      (port 8082)
```

**In plain English:**

1. When you log in, sign up, send a message, or create a post → your browser sends a request to **PHP** (through Apache), which saves it to the **MySQL database**
2. When you send a chat message → after saving it, your browser ALSO tells the **WebSocket server** → which instantly sends it to the other person's browser (no refresh needed!)
3. The WebSocket server is just for **speed** — if it's not running, the app still works, but you'd have to refresh to see new messages

---

## WAMP Settings You Might Need to Change

Most of the time, the defaults work fine. But if you run into issues:

### PHP Extensions (make sure these are ON)

Right-click the WAMP tray icon → **PHP** → **PHP extensions** → make sure these are checked:

| Extension       | Why You Need It                     |
| --------------- | ----------------------------------- |
| `php_pdo_mysql` | Connects PHP to MySQL (required!)   |
| `php_mysqli`    | Backup way to connect to MySQL      |
| `php_mbstring`  | Handles special characters properly |
| `php_fileinfo`  | Detects file types during upload    |
| `php_openssl`   | Security stuff for sessions         |

### PHP Settings (for file uploads)

Right-click the WAMP tray icon → **PHP** → **PHP Settings**:

| Setting               | Change To | Why                                      |
| --------------------- | --------- | ---------------------------------------- |
| `upload_max_filesize` | `50M`     | Allows uploading files up to 50MB        |
| `post_max_size`       | `52M`     | Must be slightly bigger than upload size |

---

## Common Problems & How to Fix Them

| Problem                                        | What to Do                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **WAMP icon is orange or red**                 | Something crashed. Right-click the icon → check Apache and MySQL error logs                                            |
| **"Port 80 already in use"**                   | Another app (like Skype or IIS) is using port 80. Close it, or change Apache's port                                    |
| **Can't open `localhost/campus360-redo/`**     | Your project folder isn't in `C:\wamp64\www\`. Re-do Step 1                                                            |
| **"Database connection failed"**               | Make sure MySQL is running (WAMP icon is green). Check that `php/config.php` has the right password (default is blank) |
| **Login/signup doesn't work**                  | You probably didn't create the database yet. Go back to Step 2                                                         |
| **Forum shows no posts / search doesn't work** | You forgot to run `database_forum.sql`. Go back to Step 2, File 2                                                      |
| **Chat messages don't appear instantly**       | The WebSocket server isn't running. Go back to Step 4, Thing 2                                                         |
| **File upload fails**                          | Change `upload_max_filesize` to `50M` in PHP settings (see above)                                                      |
| **Changes to code aren't showing up**          | Hard refresh your browser with `Ctrl + Shift + R`. If that doesn't work, disable OPcache in WAMP                       |
| **"Not authenticated" errors pop up**          | Your session expired. Clear cookies and log in again                                                                   |
| **`npm install` fails**                        | Make sure Node.js is installed. Try running PowerShell as Administrator                                                |
| **`npm start` says "port 8082 in use"**        | You already have the WebSocket server running in another terminal. Close it first                                      |

---

## Quick Reference: Ports Used

| What                     | Port | When It's Running        |
| ------------------------ | ---- | ------------------------ |
| Apache (web pages)       | 80   | When WAMP is green       |
| MySQL (database)         | 3306 | When WAMP is green       |
| WebSocket (instant chat) | 8082 | When you run `npm start` |

---

## Quick Reference: Database Credentials

These are the default WAMP settings. If you changed your MySQL password, update these files:

| Setting  | Value       | Where to Change                                         |
| -------- | ----------- | ------------------------------------------------------- |
| Host     | `localhost` | `php/config.php` (line 9) and `ws-server.js` (line 15)  |
| Database | `campus360` | `php/config.php` (line 10) and `ws-server.js` (line 16) |
| Username | `root`      | `php/config.php` (line 11) and `ws-server.js` (line 17) |
| Password | _(blank)_   | `php/config.php` (line 12) and `ws-server.js` (line 18) |

---

**Last updated:** February 2026
