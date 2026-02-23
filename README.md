# سامانه مدیریت ترافیک هوشمند - سیستان اکبری

> Traffic Control Manager - Intelligent Vehicle Traffic Monitoring Dashboard

## 🚀 Quick Start

### ⚠️ Important: Working Directory

**All commands must be run from the project directory, not from `/root/` or your home directory!**

```bash
# ❌ Wrong - using placeholder path
cd /path/to/web-monitoring-Intelligent-Vehicle-Traffic-   # This will NOT work!
# Error: No such file or directory

# ⚠️ Note: /path/to/ is just an example! You need to find the actual path.

# ✅ Correct - find the actual path first
find ~ -name "test-rmto-quick.sh" -type f 2>/dev/null
# Example output: /home/user/web-monitoring-Intelligent-Vehicle-Traffic-/test-rmto-quick.sh

# ✅ Correct - use the actual path
cd /home/user/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh   # Works!

# Or if it's in your home directory:
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-
./test-rmto-quick.sh
```

### 🔧 RMTO Integration Quick Test

```bash
# Step 1: Find the project directory
find ~ -name "test-rmto-quick.sh" -type f 2>/dev/null

# Step 2: Navigate to project directory (use the path found above)
cd ~/web-monitoring-Intelligent-Vehicle-Traffic-

# Step 3: Run quick test script (handles everything automatically)
./test-rmto-quick.sh
```

This script will:
- Create `.env` file if needed
- Install dependencies
- Run connection test
- Show clear error messages

### 🔄 Alternative: Fresh Clone

```bash
# Go to home directory
cd ~

# Clone the repository
git clone https://github.com/sad-zz/web-monitoring-Intelligent-Vehicle-Traffic-.git

# Navigate to project
cd web-monitoring-Intelligent-Vehicle-Traffic-

# Run test
./test-rmto-quick.sh
```

### Login Credentials

For static deployments (Vercel, Netlify, etc.):
- **نام کاربری / Username:** `admin`
- **رمز عبور / Password:** `admin1234`

### Live Demo

🔗 [View Live Demo](https://web-monitoring-intelligent-vehicle-git-753555-birjands-projects.vercel.app/)

## 📋 Features

- **خانه (Home)** - Dashboard with statistics and route overview
- **محورها (Routes)** - Route management with full CRUD operations
- **دستگاه‌ها (Devices)** - Device management (cameras, sensors, traffic lights, controllers)
- **گزارشات (Reports)** - Traffic reports with filtering and export
- **تنظیمات (Settings)** - System configuration and alerts

## 🛠️ Development

### Local Development

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Then open http://localhost:8000
```

### Project Structure

```
├── index.html          # Main dashboard
├── css/
│   └── style.css      # Styles (RTL, Persian UI)
├── js/
│   └── app.js         # Application logic
├── data/
│   └── devices.js     # Sample data
└── server/            # Backend (optional)
```

## 🔒 Authentication

The application supports both static and backend authentication:

- **Static Mode**: Uses localStorage for session management
- **Backend Mode**: Connects to Node.js backend when available
- Auto-fallback: Automatically switches to static mode if backend is unavailable

## 📦 Deployment

### Vercel / Netlify

Simply connect your GitHub repository and deploy. The application will work in static mode with the default credentials.

### With Backend

See the `server/` directory for backend setup instructions.

## 🌐 Language

- Interface: Persian (Farsi) - RTL
- Data: Supports Persian numbers and dates

## 📄 License

This project is proprietary software.

## 🤝 Contributing

This is a private project. For questions or support, please contact the project maintainers.
