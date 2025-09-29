# ReloadRage 🔥

A competitive web application that tracks page views for logged-in users and displays them on a real-time leaderboard.

## Features

- **User Authentication**: Secure registration and login system
- **View Tracking**: Automatically tracks page views for logged-in users
- **Real-time Leaderboard**: See who has the most page views with live updates
- **Responsive Design**: Works on desktop and mobile devices
- **Competitive Element**: Users compete to get the highest view count

## How It Works

1. **Register**: Create an account with a username and password
2. **Login**: Sign in to start tracking your page views
3. **Reload**: Every time you refresh the page, your view count increases
4. **Compete**: Climb the leaderboard by accumulating more views
5. **Track**: Monitor your progress and see real-time updates

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite3 for user data and view counts
- **Frontend**: EJS templating with vanilla JavaScript
- **Authentication**: bcryptjs for password hashing
- **Sessions**: Express-session for user management
- **Styling**: Custom CSS with gradient backgrounds and animations

## Installation

1. **Clone or download** this project to your local machine

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### For New Users
1. Click "Register" to create a new account
2. Enter a username (3-20 characters) and password (minimum 6 characters)
3. You'll be automatically logged in after registration

### For Existing Users
1. Click "Login" and enter your credentials
2. Your view count will be displayed on the dashboard
3. Every page refresh increases your view count by 1

### Competing
- The leaderboard shows the top 10 users by view count
- Your position is highlighted if you're in the top 10
- The leaderboard updates automatically every 5 seconds
- Keep refreshing to climb the ranks!

## API Endpoints

- `GET /` - Main dashboard and view tracking
- `GET /login` - Login page
- `GET /register` - Registration page
- `POST /login` - Handle login submission
- `POST /register` - Handle registration submission
- `POST /logout` - Logout and destroy session
- `GET /api/leaderboard` - Get current leaderboard data (JSON)
- `GET /api/user-stats` - Get current user's stats (JSON)

## Database Schema

### Users Table
- `id` - Primary key (auto-increment)
- `username` - Unique username
- `password` - Hashed password
- `view_count` - Number of page views (default: 0)
- `created_at` - Account creation timestamp

## Security Features

- Passwords are hashed using bcryptjs
- Session-based authentication
- SQL injection prevention with parameterized queries
- Input validation for registration
- Session expires after 24 hours

## Customization

### Changing the Port
Edit the `PORT` variable in `server.js` or set the `PORT` environment variable:
```bash
PORT=8080 npm start
```

### Modifying the Database
The SQLite database file (`database.db`) is created automatically. To reset the database, simply delete this file and restart the server.

### Styling
All styles are in `public/style.css`. The design uses:
- Gradient backgrounds
- Glass-morphism effects
- Responsive design
- Smooth animations
- Medal emojis for top 3 positions

## Development

### Project Structure
```
ReloadRage/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── database.db           # SQLite database (auto-created)
├── views/                # EJS templates
│   ├── index.ejs         # Main dashboard
│   ├── login.ejs         # Login page
│   └── register.ejs      # Registration page
└── public/               # Static files
    └── style.css         # CSS styles
```

### Adding Features
Some ideas for expansion:
- User profiles with avatars
- Daily/weekly/monthly leaderboards
- View streaks and achievements
- Social sharing
- Admin dashboard
- View history and analytics
- Dark/light theme toggle

## Troubleshooting

### Database Issues
If you encounter database errors, try deleting `database.db` and restarting the server.

### Port Already in Use
If port 3000 is busy, change the port:
```bash
PORT=8080 npm start
```

### Session Issues
Clear your browser cookies if you experience login problems.

## Deployment

This app requires a Node.js server to run. GitHub Pages only hosts static files, so you'll need to use a proper hosting service:

### Option 1: Render (Recommended - Free)
1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Connect your GitHub repository
4. Create a new "Web Service"
5. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Deploy and get your live URL!

### Option 2: Railway (Free tier available)
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Connect your GitHub repository
4. Deploy automatically with the included `railway.json`

### Option 3: Vercel
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Deploy with the included `vercel.json` configuration

### Environment Variables
For production deployment, set:
- `PORT` - Will be set automatically by most hosting services
- `NODE_ENV=production` - For production optimizations

## License

MIT License - Feel free to modify and distribute!

## Contributing

Feel free to submit issues and enhancement requests. Pull requests are welcome!

---

**Happy Reloading!** 🚀