#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Simple log streaming utility for Versal API
"""

import os
import sys
import subprocess
import argparse
from datetime import datetime

def stream_logs(log_file, follow=True, lines=50):
    """Stream logs from file using tail command"""
    if not os.path.exists(log_file):
        print(f"❌ Log file not found: {log_file}")
        return
    
    print(f"📋 Streaming logs from: {log_file}")
    print("=" * 80)
    
    try:
        if follow:
            # Real-time streaming with tail -f
            subprocess.run(["tail", "-f", "-n", str(lines), log_file])
        else:
            # Show last N lines
            subprocess.run(["tail", "-n", str(lines), log_file])
    except KeyboardInterrupt:
        print("\n🛑 Log streaming stopped")

def main():
    parser = argparse.ArgumentParser(description="Stream Versal API logs")
    parser.add_argument("log_file", help="Log file to stream")
    parser.add_argument("--follow", "-f", action="store_true", help="Follow log file in real-time")
    parser.add_argument("--lines", "-n", type=int, default=50, help="Number of lines to show")
    
    args = parser.parse_args()
    stream_logs(args.log_file, args.follow, args.lines)

if __name__ == "__main__":
    main() 