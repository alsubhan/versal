# 🌐 Web-Based Log Monitor for Versal API

A beautiful, real-time web interface for monitoring your Versal API server logs in the browser.

## 🚀 Quick Start

### One-Command Setup
```bash
# Start both API server and web monitor
./start_monitoring.sh

# Open in browser
http://localhost:5000
```

### Manual Setup
```bash
# Terminal 1: Start API server with logging
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log

# Terminal 2: Start web monitor
python3 log_monitor.py --port 5000

# Open in browser
http://localhost:5000
```

## ✨ Features

### 🎨 Beautiful Interface
- **Dark theme** optimized for log viewing
- **Monospace font** for perfect log alignment
- **Responsive design** works on desktop and mobile
- **Professional UI** with intuitive controls

### 📊 Real-Time Monitoring
- **Live streaming** using Server-Sent Events (SSE)
- **Instant updates** as new logs appear
- **Auto-scroll** to follow new logs automatically
- **Manual control** to start/stop monitoring

### 🔍 Advanced Filtering
- **Text search** - filter logs by any text
- **Log level filtering** - show only DEBUG, INFO, WARNING, or ERROR
- **Combined filters** - use both text and level filters together
- **Real-time filtering** - filters apply instantly

### 📈 Live Statistics
- **Total lines** - count of all log entries
- **Debug lines** - count of debug messages
- **Error lines** - count of error messages
- **Last update** - timestamp of most recent log

### 🎯 Color-Coded Logs
- **🔵 DEBUG** - Cyan color for debug messages
- **🔴 ERROR** - Red background for error messages
- **🟠 WARNING** - Orange color for warnings
- **🔵 INFO** - Blue color for info messages
- **⚪ NORMAL** - Default color for regular logs

## 🛠️ Installation

### Prerequisites
```bash
# Install required packages
pip install flask flask-cors

# Make scripts executable
chmod +x start_monitoring.sh log_monitor.py
```

### Dependencies
- Python 3.7+
- Flask
- Flask-CORS
- Your existing Versal API setup

## 📖 Usage Guide

### 1. Starting the Monitor

**Option A: One-command startup**
```bash
./start_monitoring.sh
```

**Option B: Manual startup**
```bash
# Start API server
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log

# Start web monitor
python3 log_monitor.py --port 5000
```

### 2. Accessing the Interface

Open your browser and navigate to:
```
http://localhost:5000
```

### 3. Using the Interface

#### Controls
- **Start Monitoring** - Begin real-time log streaming
- **Stop Monitoring** - Pause log streaming
- **Clear Logs** - Clear the current log view
- **Filter Input** - Search for specific text in logs
- **Log Level** - Filter by log level (DEBUG, INFO, WARNING, ERROR)
- **Auto-scroll** - Automatically scroll to new logs

#### Statistics Panel
- **Total Lines** - Shows total number of log entries
- **Debug** - Shows count of debug messages
- **Errors** - Shows count of error messages
- **Last Update** - Shows timestamp of most recent log

### 4. Advanced Features

#### Filtering Examples
```bash
# Show only debug messages
Select "DEBUG" from log level dropdown

# Show only error messages
Select "ERROR" from log level dropdown

# Search for specific user
Type "user_id" in filter input

# Search for permission checks
Type "permission" in filter input

# Search for product operations
Type "product" in filter input
```

#### Keyboard Shortcuts
- **Ctrl+F** - Focus on filter input (browser default)
- **Ctrl+R** - Refresh page
- **Ctrl+Shift+R** - Hard refresh

## 🔧 Configuration

### Command Line Options
```bash
python3 log_monitor.py --help

Options:
  --port PORT          Port for the web interface (default: 5000)
  --host HOST          Host to bind to (default: 0.0.0.0)
  --log-file LOG_FILE  Log file to monitor (default: logs/server.log)
```

### Examples
```bash
# Custom port
python3 log_monitor.py --port 8080

# Custom log file
python3 log_monitor.py --log-file logs/custom.log

# Custom host and port
python3 log_monitor.py --host 127.0.0.1 --port 3000
```

## 🎯 Use Cases

### Development
- **Real-time debugging** - See logs as they happen
- **Error tracking** - Quickly spot and investigate errors
- **Performance monitoring** - Monitor API response times
- **User activity** - Track user interactions and permissions

### Production Monitoring
- **Live monitoring** - Monitor production logs in real-time
- **Error alerting** - Quickly respond to production issues
- **Performance analysis** - Track system performance
- **Security monitoring** - Monitor authentication and authorization

### Team Collaboration
- **Shared monitoring** - Multiple team members can view logs
- **Remote access** - Access logs from anywhere
- **Historical analysis** - Review past logs and patterns
- **Documentation** - Use logs for system documentation

## 🚨 Troubleshooting

### Common Issues

**1. Monitor not starting**
```bash
# Check if port is available
lsof -i :5000

# Try different port
python3 log_monitor.py --port 5001
```

**2. No logs appearing**
```bash
# Check if log file exists
ls -la logs/server.log

# Check if API server is writing logs
tail -f logs/server.log
```

**3. Web interface not loading**
```bash
# Check if monitor is running
ps aux | grep log_monitor

# Check browser console for errors
# Press F12 in browser
```

**4. Slow performance**
```bash
# Check log file size
ls -lh logs/server.log

# Rotate large log files
mv logs/server.log logs/server.log.old
touch logs/server.log
```

### Performance Tips
1. **Rotate log files** regularly to prevent large files
2. **Use filters** to reduce the number of displayed logs
3. **Clear logs** periodically to free up memory
4. **Monitor log file size** to prevent performance issues

## 🔒 Security Considerations

### Development Environment
- The web monitor is designed for development use
- Runs on localhost by default
- No authentication required for local development

### Production Environment
- **Do not expose** the web monitor to the internet
- **Use VPN** or **private network** for remote access
- **Add authentication** if needed for production use
- **Monitor access logs** to track who is viewing logs

## 📱 Mobile Support

The web interface is fully responsive and works on:
- **Desktop browsers** (Chrome, Firefox, Safari, Edge)
- **Mobile browsers** (iOS Safari, Chrome Mobile)
- **Tablet browsers** (iPad, Android tablets)

## 🔄 Integration with Existing Workflow

### With Your Current Setup
The web monitor integrates seamlessly with your existing:
- **DEBUG mode** - Shows debug logs when enabled
- **File logging** - Monitors your existing log files
- **Terminal logging** - Works alongside terminal-based monitoring
- **Development workflow** - No changes to your current process

### Alternative to Terminal Monitoring
Instead of using `tail -f` in multiple terminals, you can:
- **Use one browser tab** for all log monitoring
- **Filter logs** without complex grep commands
- **Share logs** easily with team members
- **Access logs** from any device on your network

## 🎉 Benefits

### For Developers
- **Better debugging** - See logs in a clean, organized interface
- **Faster troubleshooting** - Filter and search logs quickly
- **Team collaboration** - Share log views with colleagues
- **Remote access** - Monitor logs from anywhere

### For Operations
- **Real-time monitoring** - Respond to issues immediately
- **Historical analysis** - Review past logs and patterns
- **Performance tracking** - Monitor system performance
- **Security monitoring** - Track authentication and access

### For Management
- **Visibility** - See system activity in real-time
- **Reporting** - Use logs for system reports
- **Compliance** - Maintain audit trails
- **Documentation** - Use logs for system documentation

---

**Ready to start monitoring?** Run `./start_monitoring.sh` and open http://localhost:5000 in your browser! 