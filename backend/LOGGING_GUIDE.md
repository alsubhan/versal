# Log Streaming Guide for Versal API

This guide shows you how to stream logs from your backend server for debugging and monitoring.

## 🚀 Quick Start Options

### Option 1: Web-Based Log Monitor (Recommended)
```bash
# Start both server and web monitor with one command
./start_monitoring.sh

# Then open http://localhost:5000 in your browser
```

### Option 2: Manual Setup with Web Monitor
```bash
# Terminal 1: Start server with logging
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log

# Terminal 2: Start web monitor
python3 log_monitor.py --port 5000

# Then open http://localhost:5000 in your browser
```

### Option 3: Development Mode with File Logging
```bash
# Start server with debug mode and file logging
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/dev.log

# In another terminal, stream the logs
tail -f logs/dev.log
```

### Option 4: Production Mode with File Logging
```bash
# Start server in production mode with file logging
export DEBUG=false
uvicorn main:app --port 8000 2>&1 | tee logs/prod.log

# In another terminal, stream the logs
tail -f logs/prod.log
```

## 🌐 Web-Based Log Monitoring

### Features of the Web Monitor
- **Real-time streaming** using Server-Sent Events (SSE)
- **Beautiful dark theme** interface optimized for log viewing
- **Live statistics** showing total lines, debug lines, and errors
- **Advanced filtering** by text and log level
- **Auto-scroll** option for following new logs
- **Responsive design** that works on desktop and mobile
- **Color-coded logs** (debug=cyan, errors=red, warnings=orange)

### How to Use the Web Monitor
1. **Start the services:**
   ```bash
   ./start_monitoring.sh
   ```

2. **Open in browser:**
   ```
   http://localhost:5000
   ```

3. **Features available:**
   - **Start/Stop Monitoring**: Control real-time streaming
   - **Filter Logs**: Search for specific text or log levels
   - **Clear Logs**: Clear the current view
   - **Auto-scroll**: Automatically scroll to new logs
   - **Statistics**: See live counts of different log types

### Web Monitor Screenshots
The interface includes:
- Header with controls and status
- Real-time statistics panel
- Filter controls (text search + log level)
- Scrollable log content area
- Color-coded log lines with timestamps

## 📋 Terminal-Based Log Streaming Methods

### Method 1: Using `tail -f` (Most Common)

**Start the server with logging:**
```bash
# Create logs directory
mkdir -p logs

# Start server and redirect output to file
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log
```

**Stream logs in real-time:**
```bash
# Follow logs in real-time
tail -f logs/server.log

# Show last 100 lines and follow
tail -f -n 100 logs/server.log

# Show logs with timestamps
tail -f logs/server.log | while read line; do echo "$(date '+%H:%M:%S') $line"; done
```

### Method 2: Using the Log Streamer Utility

**Start server with logging:**
```bash
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log
```

**Use the log streamer:**
```bash
# Stream in real-time
python3 log_streamer.py logs/server.log --follow

# Show last 50 lines
python3 log_streamer.py logs/server.log --lines 100
```

### Method 3: Using `less` for Interactive Log Viewing

```bash
# View logs interactively
less +F logs/server.log

# Press 'F' to follow new lines, 'Ctrl+C' to stop following
```

### Method 4: Using `grep` to Filter Logs

```bash
# Stream only debug messages
tail -f logs/server.log | grep "\[DEBUG\]"

# Stream only error messages
tail -f logs/server.log | grep -i "error"

# Stream only permission-related logs
tail -f logs/server.log | grep -i "permission"

# Stream only product-related logs
tail -f logs/server.log | grep -i "product"
```

## 🔧 Advanced Log Streaming

### Multiple Terminal Setup

**Terminal 1 - Start Server:**
```bash
export DEBUG=true
uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log
```

**Terminal 2 - Stream All Logs:**
```bash
tail -f logs/server.log
```

**Terminal 3 - Stream Only Debug Logs:**
```bash
tail -f logs/server.log | grep "\[DEBUG\]"
```

**Terminal 4 - Stream Only Errors:**
```bash
tail -f logs/server.log | grep -i "error"
```

### Log Rotation and Management

**Create a log rotation script:**
```bash
#!/bin/bash
# rotate_logs.sh

LOG_FILE="logs/server.log"
MAX_SIZE="100M"

# Check if log file exists and is larger than MAX_SIZE
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE") -gt $(numfmt --from=iec $MAX_SIZE) ]; then
    # Rotate the log file
    mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d_%H%M%S)"
    touch "$LOG_FILE"
    echo "Log file rotated at $(date)"
fi
```

**Use with cron for automatic rotation:**
```bash
# Add to crontab: check every hour
0 * * * * /path/to/rotate_logs.sh
```

### Using `tmux` for Persistent Sessions

**Start a tmux session:**
```bash
tmux new-session -d -s versal-logs
tmux split-window -h
tmux split-window -v
```

**Configure panes:**
```bash
# Pane 1: Start server
tmux send-keys -t 0 "export DEBUG=true && uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log" Enter

# Pane 2: Stream all logs
tmux send-keys -t 1 "tail -f logs/server.log" Enter

# Pane 3: Stream debug logs only
tmux send-keys -t 2 "tail -f logs/server.log | grep '\[DEBUG\]'" Enter
```

**Attach to session:**
```bash
tmux attach-session -t versal-logs
```

## 🐛 Debug Mode Logging

When DEBUG mode is enabled, you'll see detailed logs like:

```
🔧 DEBUG MODE ENABLED - Debug endpoints and features are active
[DEBUG] Checking permission 'products_view' for user ad8dc9fd-e850-4906-9f14-6da34b0f5039
[DEBUG] User ad8dc9fd-e850-4906-9f14-6da34b0f5039 has role_id: 977228e3-a283-43a5-b7c8-37cce50fc160
[DEBUG] User ad8dc9fd-e850-4906-9f14-6da34b0f5039 has role 'admin' with permissions: [...]
[DEBUG] Permission 'products_view' granted for user ad8dc9fd-e850-4906-9f14-6da34b0f5039
[DEBUG] Products endpoint: Starting query with stock_levels...
[DEBUG] Products endpoint: Query successful, got 10 products
[DEBUG] Processing product Premium Wireless Headphones: stock_levels = [...]
```

## 📊 Log Analysis Tools

### Using `awk` for Log Analysis

```bash
# Count debug messages per minute
tail -f logs/server.log | awk '/\[DEBUG\]/ {print $1, $2}' | uniq -c

# Count errors per hour
tail -f logs/server.log | awk '/ERROR/ {print $1, $2}' | cut -d: -f1,2 | uniq -c
```

### Using `jq` for JSON Log Analysis (if using JSON logging)

```bash
# Filter logs by log level
tail -f logs/server.log | jq 'select(.level == "DEBUG")'

# Filter logs by user ID
tail -f logs/server.log | jq 'select(.user_id != null)'
```

## 🚨 Troubleshooting

### Common Issues

**1. Log file not found:**
```bash
# Check if logs directory exists
ls -la logs/

# Create logs directory if missing
mkdir -p logs
```

**2. No logs appearing:**
```bash
# Check if DEBUG mode is enabled
echo $DEBUG

# Verify server is writing to log file
ps aux | grep uvicorn
```

**3. Log file too large:**
```bash
# Check log file size
ls -lh logs/server.log

# Rotate log file
mv logs/server.log logs/server.log.old
touch logs/server.log
```

### Performance Tips

1. **Use log rotation** to prevent files from growing too large
2. **Filter logs** with grep to reduce noise
3. **Use multiple terminals** for different log views
4. **Consider log aggregation** tools for production environments

## 📝 Best Practices

1. **Always use DEBUG mode** when developing or troubleshooting
2. **Stream logs in real-time** during development
3. **Filter logs** to focus on relevant information
4. **Rotate log files** regularly to manage disk space
5. **Use descriptive log messages** for easier debugging
6. **Monitor error logs** separately from debug logs

## 🔗 Quick Reference

| Command | Description |
|---------|-------------|
| `tail -f logs/server.log` | Stream logs in real-time |
| `tail -f logs/server.log \| grep "\[DEBUG\]"` | Stream only debug logs |
| `tail -f logs/server.log \| grep -i "error"` | Stream only error logs |
| `less +F logs/server.log` | Interactive log viewing |
| `python3 log_streamer.py logs/server.log --follow` | Use custom log streamer | 