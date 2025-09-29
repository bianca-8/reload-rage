const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new sqlite3.Database('./database.db');

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Global stats table for anonymous views
  db.run(`CREATE TABLE IF NOT EXISTS global_stats (
    id INTEGER PRIMARY KEY,
    anonymous_views INTEGER DEFAULT 0
  )`);
  
  // Initialize global stats if empty
  db.get(`SELECT COUNT(*) as count FROM global_stats`, (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO global_stats (id, anonymous_views) VALUES (1, 0)`);
    }
  });
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: 'reload-rage-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Routes

// Home page - tracks views for logged-in users
app.get('/', (req, res) => {
  if (req.session.userId) {
    // Increment view count for logged-in user
    db.run('UPDATE users SET view_count = view_count + 1 WHERE id = ?', [req.session.userId], (err) => {
      if (err) {
        console.error('Error updating view count:', err);
      }
    });
  } else {
    // Increment anonymous view count for non-logged-in users
    db.run('UPDATE global_stats SET anonymous_views = anonymous_views + 1 WHERE id = 1', (err) => {
      if (err) {
        console.error('Error updating anonymous view count:', err);
      }
    });
  }
  
  // Get leaderboard data and total view count
  db.all('SELECT username, view_count FROM users ORDER BY view_count DESC LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error fetching leaderboard:', err);
      rows = [];
    }
    
    // Get total view count from all users AND anonymous views
    db.all(`
      SELECT 
        (SELECT COALESCE(SUM(view_count), 0) FROM users) + 
        (SELECT COALESCE(anonymous_views, 0) FROM global_stats WHERE id = 1) as total_views
    `, (err, totalResult) => {
      if (err) {
        console.error('Error fetching total views:', err);
        totalResult = [{ total_views: 0 }];
      }
      
      const totalViews = totalResult[0]?.total_views || 0;
      
      // Get current user's stats
      if (req.session.userId) {
        db.get('SELECT username, view_count FROM users WHERE id = ?', [req.session.userId], (err, user) => {
          if (err) {
            console.error('Error fetching user stats:', err);
            user = null;
          }
          res.render('index', { 
            user: user, 
            leaderboard: rows, 
            totalViews: totalViews,
            isLoggedIn: true 
          });
        });
      } else {
        res.render('index', { 
          user: null, 
          leaderboard: rows, 
          totalViews: totalViews,
          isLoggedIn: false 
        });
      }
    });
  });
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// Register page
app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
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
    
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
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
    });
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
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// API endpoint for real-time leaderboard updates
app.get('/api/leaderboard', (req, res) => {
  db.all('SELECT username, view_count FROM users ORDER BY view_count DESC LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error fetching leaderboard:', err);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
    res.json(rows);
  });
});

// API endpoint for total view count
app.get('/api/total-views', (req, res) => {
  db.all(`
    SELECT 
      (SELECT COALESCE(SUM(view_count), 0) FROM users) + 
      (SELECT COALESCE(anonymous_views, 0) FROM global_stats WHERE id = 1) as total_views
  `, (err, result) => {
    if (err) {
      console.error('Error fetching total views:', err);
      return res.status(500).json({ error: 'Failed to fetch total views' });
    }
    res.json({ total_views: result[0]?.total_views || 0 });
  });
});

// API endpoint for user stats
app.get('/api/user-stats', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  db.get('SELECT username, view_count FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err) {
      console.error('Error fetching user stats:', err);
      return res.status(500).json({ error: 'Failed to fetch user stats' });
    }
    res.json(user);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`ReloadRage server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});