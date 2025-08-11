#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Web-based log monitoring interface for Versal API
Provides real-time log streaming in the browser
"""

import os
import sys
import time
import json
import threading
from datetime import datetime
from flask import Flask, render_template_string, Response, request, jsonify
from flask_cors import CORS
import queue

app = Flask(__name__)
CORS(app)

# Global variables
log_file_path = "logs/server.log"
log_queue = queue.Queue()
is_monitoring = False
monitor_thread = None

# HTML template for the log monitor interface
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Versal API Log Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
        }
        
        .header {
            background: #2d2d30;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #4ec9b0;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #007acc;
            color: white;
        }
        
        .btn-primary:hover {
            background: #005a9e;
        }
        
        .btn-danger {
            background: #d73a49;
            color: white;
        }
        
        .btn-danger:hover {
            background: #b31d28;
        }
        
        .btn-success {
            background: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background: #1e7e34;
        }
        
        .status {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
        }
        
        .status.active {
            background: #28a745;
            color: white;
        }
        
        .status.inactive {
            background: #6c757d;
            color: white;
        }
        
        .filters {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .filter-input {
            padding: 6px 12px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #3c3c3c;
            color: #d4d4d4;
            font-size: 14px;
        }
        
        .filter-input:focus {
            outline: none;
            border-color: #007acc;
        }
        
        .log-container {
            background: #252526;
            border-radius: 8px;
            padding: 20px;
            height: calc(100vh - 200px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #3c3c3c;
        }
        
        .log-stats {
            display: flex;
            gap: 20px;
            font-size: 14px;
        }
        
        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .stat-value {
            font-weight: bold;
            color: #4ec9b0;
        }
        
        .log-content {
            flex: 1;
            overflow-y: auto;
            background: #1e1e1e;
            border-radius: 4px;
            padding: 15px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .log-line {
            margin-bottom: 2px;
            padding: 2px 0;
        }
        
        .log-line.debug {
            color: #4ec9b0;
        }
        
        .log-line.error {
            color: #f14c4c;
            background: rgba(241, 76, 76, 0.1);
            padding: 2px 4px;
            border-radius: 2px;
        }
        
        .log-line.warning {
            color: #ffa500;
        }
        
        .log-line.info {
            color: #007acc;
        }
        
        .timestamp {
            color: #6c757d;
            font-size: 12px;
        }
        
        .auto-scroll {
            margin-left: 10px;
        }
        
        .auto-scroll input {
            margin-right: 5px;
        }
        
        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                align-items: stretch;
            }
            
            .controls {
                justify-content: center;
            }
            
            .filters {
                justify-content: center;
            }
            
            .log-stats {
                flex-direction: column;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🔍 Versal API Log Monitor</div>
        <div class="controls">
            <div class="filters">
                <input type="text" id="filterInput" class="filter-input" placeholder="Filter logs..." />
                <select id="logLevel" class="filter-input">
                    <option value="">All Levels</option>
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                </select>
            </div>
            <button id="startBtn" class="btn btn-success">Start Monitoring</button>
            <button id="stopBtn" class="btn btn-danger" style="display: none;">Stop Monitoring</button>
            <button id="clearBtn" class="btn btn-primary">Clear Logs</button>
            <div id="status" class="status inactive">Inactive</div>
        </div>
    </div>
    
    <div class="log-container">
        <div class="log-header">
            <div class="log-stats">
                <div class="stat">
                    <span>Total Lines:</span>
                    <span id="totalLines" class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span>Debug:</span>
                    <span id="debugLines" class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span>Errors:</span>
                    <span id="errorLines" class="stat-value">0</span>
                </div>
                <div class="stat">
                    <span>Last Update:</span>
                    <span id="lastUpdate" class="stat-value">Never</span>
                </div>
            </div>
            <div class="auto-scroll">
                <input type="checkbox" id="autoScroll" checked />
                <label for="autoScroll">Auto-scroll</label>
            </div>
        </div>
        <div id="logContent" class="log-content"></div>
    </div>

    <script>
        let isMonitoring = false;
        let logLines = [];
        let filteredLines = [];
        let stats = {
            total: 0,
            debug: 0,
            error: 0
        };
        
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const clearBtn = document.getElementById('clearBtn');
        const status = document.getElementById('status');
        const logContent = document.getElementById('logContent');
        const filterInput = document.getElementById('filterInput');
        const logLevel = document.getElementById('logLevel');
        const autoScroll = document.getElementById('autoScroll');
        
        // Event listeners
        startBtn.addEventListener('click', startMonitoring);
        stopBtn.addEventListener('click', stopMonitoring);
        clearBtn.addEventListener('click', clearLogs);
        filterInput.addEventListener('input', filterLogs);
        logLevel.addEventListener('change', filterLogs);
        
        function startMonitoring() {
            if (isMonitoring) return;
            
            isMonitoring = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            status.textContent = 'Active';
            status.className = 'status active';
            
            // Start SSE connection
            const eventSource = new EventSource('/stream');
            
            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                addLogLine(data.line, data.timestamp);
            };
            
            eventSource.onerror = function(event) {
                console.error('SSE Error:', event);
                stopMonitoring();
            };
            
            // Store eventSource for cleanup
            window.eventSource = eventSource;
        }
        
        function stopMonitoring() {
            if (!isMonitoring) return;
            
            isMonitoring = false;
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            status.textContent = 'Inactive';
            status.className = 'status inactive';
            
            if (window.eventSource) {
                window.eventSource.close();
                window.eventSource = null;
            }
        }
        
        function addLogLine(line, timestamp) {
            const logLine = {
                text: line,
                timestamp: timestamp,
                type: getLogType(line)
            };
            
            logLines.push(logLine);
            stats.total++;
            
            if (logLine.type === 'debug') stats.debug++;
            if (logLine.type === 'error') stats.error++;
            
            updateStats();
            filterLogs();
        }
        
        function getLogType(line) {
            if (line.includes('[DEBUG]')) return 'debug';
            if (line.toLowerCase().includes('error')) return 'error';
            if (line.toLowerCase().includes('warning')) return 'warning';
            if (line.includes('INFO:')) return 'info';
            return 'normal';
        }
        
        function filterLogs() {
            const filter = filterInput.value.toLowerCase();
            const level = logLevel.value;
            
            filteredLines = logLines.filter(line => {
                const matchesFilter = !filter || line.text.toLowerCase().includes(filter);
                const matchesLevel = !level || line.text.includes(level);
                return matchesFilter && matchesLevel;
            });
            
            displayLogs();
        }
        
        function displayLogs() {
            logContent.innerHTML = filteredLines.map(line => {
                const timestamp = new Date(line.timestamp).toLocaleTimeString();
                return `<div class="log-line ${line.type}">
                    <span class="timestamp">[${timestamp}]</span> ${escapeHtml(line.text)}
                </div>`;
            }).join('');
            
            if (autoScroll.checked) {
                logContent.scrollTop = logContent.scrollHeight;
            }
        }
        
        function updateStats() {
            document.getElementById('totalLines').textContent = stats.total;
            document.getElementById('debugLines').textContent = stats.debug;
            document.getElementById('errorLines').textContent = stats.error;
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }
        
        function clearLogs() {
            logLines = [];
            filteredLines = [];
            stats = { total: 0, debug: 0, error: 0 };
            updateStats();
            displayLogs();
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Load existing logs and start monitoring when page loads
        window.addEventListener('load', () => {
            // Load existing logs first
            fetch('/api/logs')
                .then(response => response.json())
                .then(data => {
                    if (data.logs) {
                        data.logs.forEach(log => {
                            addLogLine(log.line, log.timestamp);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error loading existing logs:', error);
                })
                .finally(() => {
                    // Start monitoring after loading existing logs
                    setTimeout(startMonitoring, 500);
                });
        });
    </script>
</body>
</html>
"""

def monitor_log_file():
    """Monitor the log file and send updates to connected clients"""
    global is_monitoring, log_queue
    
    if not os.path.exists(log_file_path):
        print(f"Log file not found: {log_file_path}")
        return
    
    with open(log_file_path, 'r') as f:
        # Go to end of file
        f.seek(0, 2)
        
        while is_monitoring:
            line = f.readline()
            if line:
                # Send line to queue for SSE
                log_queue.put({
                    'line': line.strip(),
                    'timestamp': datetime.now().isoformat()
                })
            else:
                time.sleep(0.1)  # Small delay to prevent high CPU usage

@app.route('/')
def index():
    """Serve the log monitor interface"""
    # Auto-start monitoring when page loads
    global is_monitoring, monitor_thread
    if not is_monitoring:
        is_monitoring = True
        monitor_thread = threading.Thread(target=monitor_log_file, daemon=True)
        monitor_thread.start()
    
    return render_template_string(HTML_TEMPLATE)

@app.route('/stream')
def stream():
    """Server-Sent Events endpoint for real-time log streaming"""
    def generate():
        while True:
            try:
                # Wait for new log entries
                data = log_queue.get(timeout=1)
                yield f"data: {json.dumps(data)}\n\n"
            except queue.Empty:
                # Send keepalive
                yield f"data: {json.dumps({'keepalive': True})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/status')
def get_status():
    """Get monitoring status"""
    return jsonify({
        'is_monitoring': is_monitoring,
        'log_file': log_file_path,
        'log_file_exists': os.path.exists(log_file_path)
    })

@app.route('/api/start', methods=['POST'])
def start_monitoring():
    """Start log monitoring"""
    global is_monitoring, monitor_thread
    
    if is_monitoring:
        return jsonify({'status': 'already_monitoring'})
    
    is_monitoring = True
    monitor_thread = threading.Thread(target=monitor_log_file, daemon=True)
    monitor_thread.start()
    
    return jsonify({'status': 'started'})

@app.route('/api/stop', methods=['POST'])
def stop_monitoring():
    """Stop log monitoring"""
    global is_monitoring
    
    is_monitoring = False
    return jsonify({'status': 'stopped'})

@app.route('/api/logs')
def get_logs():
    """Get recent logs"""
    if not os.path.exists(log_file_path):
        return jsonify({'logs': [], 'error': 'Log file not found'})
    
    try:
        with open(log_file_path, 'r') as f:
            lines = f.readlines()
            # Return last 100 lines with timestamps
            recent_lines = lines[-100:] if len(lines) > 100 else lines
            logs_with_timestamps = []
            for line in recent_lines:
                line = line.strip()
                if line:
                    logs_with_timestamps.append({
                        'line': line,
                        'timestamp': datetime.now().isoformat()
                    })
            return jsonify({'logs': logs_with_timestamps})
    except Exception as e:
        return jsonify({'logs': [], 'error': str(e)})

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Web-based log monitor for Versal API')
    parser.add_argument('--port', type=int, default=5000, help='Port for the web interface')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--log-file', default='logs/server.log', help='Log file to monitor')
    
    args = parser.parse_args()
    
    global log_file_path
    log_file_path = args.log_file
    
    print(f"🔍 Starting Versal API Log Monitor")
    print(f"📁 Monitoring log file: {log_file_path}")
    print(f"🌐 Web interface: http://{args.host}:{args.port}")
    print(f"📋 Log file exists: {os.path.exists(log_file_path)}")
    print("\n💡 Usage:")
    print("1. Start your server with logging: export DEBUG=true && uvicorn main:app --reload --port 8000 2>&1 | tee logs/server.log")
    print("2. Open http://localhost:5000 in your browser")
    print("3. Click 'Start Monitoring' to begin real-time log streaming")
    
    app.run(host=args.host, port=args.port, debug=False, threaded=True)

if __name__ == '__main__':
    main() 