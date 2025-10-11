const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const serverless = require('serverless-http');

const app = express();

// SQLite database
let db;
// Helper to initialize schema after DB is ready
function initDb(database) {
  db = database;
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS global_stats (
      id INTEGER PRIMARY KEY,
      anonymous_views INTEGER DEFAULT 0
    )`);

    db.get(`SELECT COUNT(*) as count FROM global_stats`, (err, row) => {
      if (err) {
        console.error('Error checking global_stats table:', err);
        return;
      }
      if (!row || row.count === 0) {
        db.run(`INSERT INTO global_stats (id, anonymous_views) VALUES (1, 0)`, (insertErr) => {
          if (insertErr) console.error('Error initializing global_stats:', insertErr);
        });
      }
    });
  });
}

// Try to open a persistent file-based DB; on serverless platforms this may fail or be read-only.
const fileDbPath = path.join(__dirname, '../database.db');
try {
  const fileDb = new sqlite3.Database(fileDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.warn('Could not open file DB at', fileDbPath, 'falling back to in-memory DB. Error:', err.message);
      const memDb = new sqlite3.Database(':memory:', (memErr) => {
        if (memErr) console.error('Failed to open in-memory SQLite DB:', memErr);
        initDb(memDb);
      });
    } else {
      initDb(fileDb);
    }
  });
} catch (err) {
  console.error('Unexpected error opening SQLite DB, falling back to in-memory:', err);
  const memDb = new sqlite3.Database(':memory:', (memErr) => {
    if (memErr) console.error('Failed to open in-memory SQLite DB:', memErr);
    initDb(memDb);
  });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Session configuration
app.use(
  session({
    secret: 'reload-rage-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  })
);

// Routes

app.get('/', (req, res) => {
  if (req.session.userId) {
    db.run(
      'UPDATE users SET view_count = view_count + 1 WHERE id = ?',
      [req.session.userId],
      (err) => {
        if (err) console.error('Error updating view count:', err);
      }
    );
  } else {
    db.run(
      'UPDATE global_stats SET anonymous_views = anonymous_views + 1 WHERE id = 1',
      (err) => {
        if (err) console.error('Error updating anonymous view count:', err);
      }
    );
  }

  db.all(
    'SELECT username, view_count FROM users ORDER BY view_count DESC LIMIT 10',
    (err, rows) => {
      if (err) {
        console.error('Error fetching leaderboard:', err);
        rows = [];
      }

      db.all(
        `
        SELECT 
          (SELECT COALESCE(SUM(view_count), 0) FROM users) + 
          (SELECT COALESCE(anonymous_views, 0) FROM global_stats WHERE id = 1) as total_views
        `,
        (err, totalResult) => {
          if (err) {
            console.error('Error fetching total views:', err);
            totalResult = [{ total_views: 0 }];
          }

          const totalViews = totalResult[0]?.total_views || 0;

          if (req.session.userId) {
            db.get(
              'SELECT username, view_count FROM users WHERE id = ?',
              [req.session.userId],
              (err, user) => {
                if (err) {
                  console.error('Error fetching user stats:', err);
                  user = null;
                }
                try {
                  res.render('index', {
                    user: user,
                    leaderboard: rows,
                    totalViews: totalViews,
                    isLoggedIn: true,
                  });
                } catch (renderErr) {
                  console.error('Render error (index, logged-in):', renderErr);
                  return res.status(500).send('Template render error');
                }
              }
            );
          } else {
            try {
              res.render('index', {
                user: null,
                leaderboard: rows,
                totalViews: totalViews,
                isLoggedIn: false,
              });
            } catch (renderErr) {
              console.error('Render error (index, anon):', renderErr);
              return res.status(500).send('Template render error');
            }
          }
        }
      );
    }
  );
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null });
});

// Register page
app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null });
});

// Handle registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.render('register', { error: 'Password must be at least 6 characters long' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function (err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.render('register', { error: 'Username already exists' });
          }
          console.error('Registration error:', err);
          return res.render('register', { error: 'Registration failed' });
        }

        req.session.userId = this.lastID;
        req.session.username = username;
        res.redirect('/');
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { error: 'Registration failed' });
  }
});

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.render('login', { error: 'Login failed' });
    }

    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.render('login', { error: 'Invalid username or password' });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    } catch (error) {
      console.error('Login error:', error);
      res.render('login', { error: 'Login failed' });
    }
  });
});

// Handle logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// API endpoints
app.get('/api/leaderboard', (req, res) => {
  db.all('SELECT username, view_count FROM users ORDER BY view_count DESC LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error fetching leaderboard:', err);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
    res.json(rows);
  });
});

app.get('/api/total-views', (req, res) => {
  db.all(
    `
    SELECT 
      (SELECT COALESCE(SUM(view_count), 0) FROM users) + 
      (SELECT COALESCE(anonymous_views, 0) FROM global_stats WHERE id = 1) as total_views
    `,
    (err, result) => {
      if (err) {
        console.error('Error fetching total views:', err);
        return res.status(500).json({ error: 'Failed to fetch total views' });
      }
      res.json({ total_views: result[0]?.total_views || 0 });
    }
  );
});

app.get('/api/user-stats', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

  db.get('SELECT username, view_count FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      console.error('Error fetching user stats:', err);
      return res.status(500).json({ error: 'Failed to fetch user stats' });
    }
    res.json(user);
  });
});

// Graceful shutdown (optional)
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    process.exit(0);
  });
});

// Export the serverless function for Vercel
module.exports = serverless(app);
