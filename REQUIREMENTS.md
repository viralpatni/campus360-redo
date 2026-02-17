# Campus360 — Setup & Requirements Guide

> Complete guide to run the Campus360 web application locally on Windows.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Step 1: Install WAMP Server](#step-1-install-wamp-server)
- [Step 2: Configure WAMP Settings](#step-2-configure-wamp-settings)
- [Step 3: Set Up the Project Files](#step-3-set-up-the-project-files)
- [Step 4: Set Up the Database](#step-4-set-up-the-database)
- [Step 5: Install Node.js & Dependencies](#step-5-install-nodejs--dependencies)
- [Step 6: Start the Application](#step-6-start-the-application)
- [Project Structure](#project-structure)
- [API Endpoints Reference](#api-endpoints-reference)
- [Communication Patterns](#communication-patterns)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Software       | Version         | Download Link                                      |
| -------------- | --------------- | -------------------------------------------------- |
| **WampServer** | 3.3.0+          | https://www.wampserver.com/en/                     |
| **PHP**        | 8.3+            | *(included with WAMP)*                             |
| **MySQL**      | 8.0+ / MariaDB  | *(included with WAMP)*                             |
| **Apache**     | 2.4+            | *(included with WAMP)*                             |
| **Node.js**    | 18.x LTS or 20+ | https://nodejs.org/                                |
| **npm**        | 9+              | *(included with Node.js)*                          |
| **Web Browser**| Chrome / Edge   | Any modern browser supporting WebSocket API        |

---

## Technology Stack

| Layer           | Technology                                 |
| --------------- | ------------------------------------------ |
| **Frontend**    | HTML5, CSS3, Vanilla JavaScript (ES6+)     |
| **Backend API** | PHP 8.3 (PDO for MySQL)                    |
| **Database**    | MySQL 8.0 / MariaDB (InnoDB, utf8mb4)      |
| **Web Server**  | Apache 2.4 (via WAMP)                      |
| **Real-Time**   | Node.js WebSocket server (`ws` library)    |
| **Sessions**    | PHP native sessions (`session_start()`)    |
| **Passwords**   | `password_hash()` / `password_verify()` (bcrypt) |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                     BROWSER                        │
│                                                    │
│  login.html ─── index.html ─── forum.html          │
│                  chat.html ─── messages.html        │
│                                                    │
│  JS: auth.js, chat.js, messages.js, forum.js       │
└──────────┬──────────────────────┬──────────────────┘
           │ HTTP (AJAX/Fetch)    │ WebSocket (ws://)
           ▼                     ▼
┌──────────────────┐   ┌─────────────────────┐
│   Apache + PHP   │   │  Node.js WS Server  │
│   (WAMP)         │   │  Port 8082          │
│   Port 80        │   │  ws-server.js       │
│                  │   │                     │
│  php/auth.php    │   │  Real-time:         │
│  php/chat.php    │   │  - Message delivery │
│  php/forum_api.php│  │  - Typing indicator │
│  php/upload.php  │   │  - Invite alerts    │
│  php/config.php  │   │                     │
└────────┬─────────┘   └──────────┬──────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────┐
│              MySQL Database                 │
│              "campus360"                    │
│                                             │
│  Tables: users, chat_invites, conversations,│
│  conversation_members, messages, follows,   │
│  posts, post_likes, post_comments           │
└─────────────────────────────────────────────┘
```

---

## Step 1: Install WAMP Server

1. Download WampServer from https://www.wampserver.com/en/
2. Run the installer and follow the default prompts
3. Launch WampServer — the **tray icon should turn green** (green = all services running)
4. Verify by opening `http://localhost/` in your browser — the WAMP homepage should load

---

## Step 2: Configure WAMP Settings

### Required PHP Extensions

Open WAMP tray → **PHP** → **PHP extensions** and ensure these are **enabled** (checked):

| Extension          | Purpose                          |
| ------------------ | -------------------------------- |
| `php_pdo_mysql`    | Database connection via PDO      |
| `php_mysqli`       | Alternative MySQL support        |
| `php_mbstring`     | String encoding (utf8mb4)        |
| `php_fileinfo`     | MIME type detection for uploads  |
| `php_openssl`      | Secure hashing & sessions        |
| `php_gd`           | Image handling (if needed)       |

### Recommended PHP Settings

Open WAMP tray → **PHP** → **PHP Settings**:

| Setting                  | Recommended Value | Reason                           |
| ------------------------ | ----------------- | -------------------------------- |
| `upload_max_filesize`    | `50M`             | Supports media uploads up to 50MB|
| `post_max_size`          | `52M`             | Must be ≥ upload_max_filesize    |
| `max_execution_time`     | `120`             | Prevents timeout on large uploads|
| `session.cookie_httponly` | `On`             | Session security                 |

> **Optional:** Disable `opcache.enable` if your code changes aren't reflecting instantly (WAMP tray → PHP → PHP Settings → uncheck `opcache.enable`).

### Apache Modules

Open WAMP tray → **Apache** → **Apache modules** and ensure these are **enabled**:

| Module           | Purpose                    |
| ---------------- | -------------------------- |
| `rewrite_module` | URL rewriting (if needed)  |
| `headers_module` | CORS and custom headers    |

---

## Step 3: Set Up the Project Files

### Option A: Symlink (Recommended)

This keeps your project in its original location while WAMP serves it. Run **PowerShell as Administrator**:

```powershell
cmd /c mklink /J "C:\wamp64\www\campus360-redo" "D:\path\to\campus360-redo"
```

Replace `D:\path\to\campus360-redo` with the actual path to this project folder.

### Option B: Direct Copy

Copy the entire project folder into `C:\wamp64\www\`:

```
C:\wamp64\www\campus360-redo\
```

### Verify

Open `http://localhost/campus360-redo/` in your browser — you should see the login page redirect.

---

## Step 4: Set Up the Database

### 4.1 — Create the Database & Core Tables

1. Open **phpMyAdmin** at `http://localhost/phpmyadmin/`
2. Login with username `root` and **no password** (default WAMP credentials)
3. Go to the **SQL** tab and run the contents of `database.sql`:

```sql
-- This creates the 'campus360' database and tables:
-- users, chat_invites, conversations, conversation_members, messages
SOURCE database.sql;
```

Or copy-paste the entire contents of `database.sql` and click **Go**.

### 4.2 — Create the Forum Tables

After the core tables are created, run `database_forum.sql`:

```sql
-- This adds forum tables:
-- follows, posts, post_likes, post_comments
SOURCE database_forum.sql;
```

> **Important:** Run `database.sql` FIRST, then `database_forum.sql` — the forum tables have foreign key dependencies on the `users` table.

### 4.3 — Verify Database

After running both scripts, the `campus360` database should contain **9 tables**:

| Table                    | Purpose                      |
| ------------------------ | ---------------------------- |
| `users`                  | User accounts                |
| `chat_invites`           | Chat invite requests         |
| `conversations`          | Direct & group conversations |
| `conversation_members`   | Members in each conversation |
| `messages`               | Chat messages                |
| `follows`                | Follow/unfollow system       |
| `posts`                  | Forum posts (public/private) |
| `post_likes`             | User likes on posts          |
| `post_comments`          | Comments on posts            |

### Database Credentials

The app uses these defaults (configured in `php/config.php` and `ws-server.js`):

| Key        | Value       |
| ---------- | ----------- |
| Host       | `localhost` |
| Database   | `campus360` |
| Username   | `root`      |
| Password   | *(empty)*   |

If your MySQL has a different password, update both `php/config.php` (line 12) and `ws-server.js` (line 15).

---

## Step 5: Install Node.js & Dependencies

The WebSocket server requires Node.js. In a terminal, navigate to the project folder and install dependencies:

```bash
cd /path/to/campus360-redo
npm install
```

This installs the following packages (defined in `package.json`):

| Package   | Version  | Purpose                                     |
| --------- | -------- | ------------------------------------------- |
| `ws`      | ^8.16.0  | WebSocket server library for real-time chat |
| `mysql2`  | ^3.9.0   | MySQL client for Node.js (async/await)      |

---

## Step 6: Start the Application

You need **two services running simultaneously**:

### 1. Start WAMP Server

- Launch WampServer from the Start Menu
- Wait for the tray icon to turn **green**
- This starts Apache (port 80) and MySQL (port 3306)

### 2. Start the WebSocket Server

Open a terminal in the project folder and run:

```bash
npm start
```

Or equivalently:

```bash
node ws-server.js
```

You should see:

```
[DB] Connected to MySQL
[WS] WebSocket server running on ws://localhost:8082
```

### 3. Access the Application

Open your browser and navigate to:

```
http://localhost/campus360-redo/
```

You'll be redirected to `login.html` if not logged in.

---

## Project Structure

```
campus360-redo/
├── index.html              # Landing / home page
├── login.html              # Login & signup page
├── chat.html               # Chat invite management
├── messages.html           # Real-time messaging interface
├── forum.html              # Social forum feed
├── styles.css              # Global stylesheet
├── script.js               # Shared utility scripts
│
├── js/
│   ├── auth.js             # Authentication logic & session guard
│   ├── chat.js             # Chat invites & conversation logic
│   ├── messages.js         # Real-time messaging (WebSocket client)
│   └── forum.js            # Forum posts, likes, comments, follows
│
├── php/
│   ├── config.php          # DB connection, session, helper functions
│   ├── auth.php            # Auth API (signup, login, logout, check)
│   ├── chat.php            # Chat API (invites, conversations, messages)
│   ├── forum_api.php       # Forum API (posts, likes, comments, follows)
│   └── upload.php          # File upload API (images, videos, audio)
│
├── ws-server.js            # Node.js WebSocket server
├── package.json            # Node.js dependencies
│
├── database.sql            # Core DB schema (run first)
├── database_forum.sql      # Forum DB schema (run second)
│
├── uploads/                # User-uploaded media (auto-created)
│   ├── image/
│   ├── video/
│   └── audio/
│
└── img1.jpg ... img4.jpg   # Static assets
```

---

## API Endpoints Reference

### Authentication — `php/auth.php`

| Action      | Method | Params                                         |
| ----------- | ------ | ---------------------------------------------- |
| `signup`    | POST   | name, username, regno, email, password         |
| `login`     | POST   | identifier (username/email), password          |
| `logout`    | POST   | *(none, uses session)*                         |
| `check`     | GET    | *(none, checks session)*                       |
| `get_user`  | GET    | id                                             |

### Chat — `php/chat.php`

| Action                | Method | Params                             |
| --------------------- | ------ | ---------------------------------- |
| `search_users`        | GET    | q (query string, min 2 chars)      |
| `send_invite`         | POST   | to_user (user ID)                  |
| `respond_invite`      | POST   | invite_id, response (accepted/rejected) |
| `get_invites`         | GET    | type (received/sent)               |
| `get_conversations`   | GET    | *(none)*                           |
| `get_messages`        | GET    | conversation_id, after (timestamp) |
| `send_message`        | POST   | conversation_id, content, message_type |
| `create_group`        | POST   | name, members (JSON array)         |
| `add_member`          | POST   | conversation_id, user_id           |
| `get_members`         | GET    | conversation_id                    |

### Forum — `php/forum_api.php`

| Action              | Method | Params                               |
| ------------------- | ------ | ------------------------------------ |
| `get_feed`          | GET    | page                                 |
| `create_post`       | POST   | content, visibility (public/private), image_path |
| `delete_post`       | POST   | post_id                              |
| `like_post`         | POST   | post_id                              |
| `get_comments`      | GET    | post_id                              |
| `add_comment`       | POST   | post_id, content                     |
| `send_follow`       | POST   | user_id                              |
| `respond_follow`    | POST   | follow_id, response (accepted/rejected) |
| `get_follow_requests` | GET  | *(none)*                             |
| `get_followers`     | GET    | user_id                              |
| `search_users`      | GET    | q (query string)                     |
| `get_profile`       | GET    | user_id                              |

### File Upload — `php/upload.php`

| Method | Content-Type        | Params                            |
| ------ | ------------------- | --------------------------------- |
| POST   | multipart/form-data | file (binary), type (image/video/audio) |

Max file size: **50 MB**

---

## Communication Patterns

### 1. AJAX / Fetch (HTTP)

All PHP API calls use the browser's **Fetch API** (or XMLHttpRequest). These handle:
- User authentication (login, signup, session checks)
- Sending & loading chat messages (persisted to database)
- Forum posts, likes, comments, follow requests
- File uploads
- User search

**Pattern:** Client → HTTP Request → Apache → PHP → MySQL → PHP → HTTP Response → Client

### 2. WebSocket (Real-Time)

The Node.js WebSocket server (`ws-server.js`) on **port 8082** handles instant delivery of:

| Event Type     | Description                                           |
| -------------- | ----------------------------------------------------- |
| `auth`         | Client authenticates its WebSocket connection          |
| `new_message`  | Broadcasts a new chat message to conversation members  |
| `typing`       | Shows typing indicators to other conversation members  |
| `new_invite`   | Notifies a user when they receive a chat invite        |

**Pattern:** Client A → WebSocket → Node.js Server → WebSocket → Client B (instant, no page refresh)

**How it works together:**
1. Messages are **saved to MySQL via PHP** (HTTP POST to `chat.php?action=send_message`)
2. After saving, the sender **broadcasts via WebSocket** to notify other members instantly
3. Recipients receive the message in real-time without polling

---

## Troubleshooting

| Problem                           | Solution                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| WAMP icon is orange/red           | A service failed — check Apache/MySQL error logs via tray     |
| Port 80 already in use            | Skype or IIS may be using port 80 — close them or change Apache port |
| PHP changes not reflecting        | Hard refresh (`Ctrl+Shift+R`), disable OPcache, restart WAMP |
| "Database connection failed"      | Ensure MySQL is running, credentials match `config.php`       |
| WebSocket won't connect           | Ensure `node ws-server.js` is running in a terminal           |
| Messages don't appear instantly   | WebSocket server must be running alongside WAMP               |
| File upload fails                 | Check `upload_max_filesize` in PHP settings (must be ≥ 50M)   |
| "Not authenticated" errors        | Clear cookies, re-login — sessions may have expired           |
| Can't access `localhost/campus360-redo/` | Ensure project is in `C:\wamp64\www\` or symlinked there |

---

## Ports Summary

| Service          | Port  | Protocol |
| ---------------- | ----- | -------- |
| Apache (WAMP)    | 80    | HTTP     |
| MySQL (WAMP)     | 3306  | TCP      |
| WebSocket Server | 8082  | WS       |

---

*Last updated: February 2026*
