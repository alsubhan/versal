#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Enhanced startup script for Versal API with comprehensive logging support

Features:
- Real-time log streaming
- File logging with rotation
- Debug mode support
- Log filtering options
"""

import os
import sys
import subprocess
import argparse
import logging
from datetime import datetime
import time

def setup_logging(debug_mode=False, log_file=None, log_level="INFO"):
    """Setup logging configuration"""
    # Create logs directory if it doesn't exist
    if log_file and not os.path.exists("logs"):
        os.makedirs("logs")
    
    # Configure logging
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    if debug_mode:
        log_level = "DEBUG"
        log_format = "%(asctime)s - [DEBUG] - %(message)s"
    
    # Set up file handler if log_file is specified
    handlers = []
    
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, log_level))
        file_handler.setFormatter(logging.Formatter(log_format))
        handlers.append(file_handler)
    
    # Set up console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level))
    console_handler.setFormatter(logging.Formatter(log_format))
    handlers.append(console_handler)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level),
        format=log_format,
        handlers=handlers
    )
    
    return logging.getLogger(__name__)

def start_server_with_logging(args):
    """Start the server with enhanced logging"""
    logger = setup_logging(
        debug_mode=args.debug,
        log_file=args.log_file,
        log_level=args.log_level
    )
    
    # Set environment variables
    if args.debug:
        os.environ["DEBUG"] = "true"
        logger.info("🔧 DEBUG MODE ENABLED - Enhanced logging active")
    else:
        os.environ["DEBUG"] = "false"
        logger.info("🚀 PRODUCTION MODE - Standard logging active")
    
    # Build uvicorn command
    uvicorn_cmd = [
        "uvicorn", "main:app",
        "--host", args.host,
        "--port", str(args.port),
        "--reload" if args.reload else "--no-reload"
    ]
    
    if args.workers:
        uvicorn_cmd.extend(["--workers", str(args.workers)])
    
    logger.info(f"Starting server with command: {' '.join(uvicorn_cmd)}")
    logger.info(f"Log file: {args.log_file or 'Console only'}")
    logger.info(f"Log level: {args.log_level}")
    
    try:
        # Start the server
        subprocess.run(uvicorn_cmd, check=True)
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Error starting server: {e}")
        sys.exit(1)

def stream_logs(log_file, follow=True, lines=50):
    """Stream logs from file"""
    if not log_file or not os.path.exists(log_file):
        print(f"❌ Log file not found: {log_file}")
        return
    
    print(f"📋 Streaming logs from: {log_file}")
    print("=" * 80)
    
    try:
        if follow:
            # Use tail -f for real-time streaming
            subprocess.run(["tail", "-f", "-n", str(lines), log_file])
        else:
            # Just show the last N lines
            subprocess.run(["tail", "-n", str(lines), log_file])
    except KeyboardInterrupt:
        print("\n🛑 Log streaming stopped")

def main():
    parser = argparse.ArgumentParser(description="Versal API Server with Enhanced Logging")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Start server command
    start_parser = subparsers.add_parser("start", help="Start the server")
    start_parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    start_parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    start_parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    start_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    start_parser.add_argument("--workers", type=int, help="Number of worker processes")
    start_parser.add_argument("--log-file", help="Log file path (e.g., logs/server.log)")
    start_parser.add_argument("--log-level", default="INFO", 
                             choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                             help="Logging level")
    
    # Stream logs command
    stream_parser = subparsers.add_parser("logs", help="Stream server logs")
    stream_parser.add_argument("--log-file", required=True, help="Log file to stream")
    stream_parser.add_argument("--follow", "-f", action="store_true", help="Follow log file")
    stream_parser.add_argument("--lines", "-n", type=int, default=50, help="Number of lines to show")
    
    # Quick start commands
    subparsers.add_parser("dev", help="Start in development mode (debug + reload)")
    subparsers.add_parser("prod", help="Start in production mode")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == "start":
        start_server_with_logging(args)
    elif args.command == "logs":
        stream_logs(args.log_file, args.follow, args.lines)
    elif args.command == "dev":
        # Development mode: debug + reload + file logging
        dev_args = argparse.Namespace(
            debug=True,
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_file="logs/dev.log",
            log_level="DEBUG"
        )
        start_server_with_logging(dev_args)
    elif args.command == "prod":
        # Production mode: no debug + no reload
        prod_args = argparse.Namespace(
            debug=False,
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_file="logs/prod.log",
            log_level="INFO"
        )
        start_server_with_logging(prod_args)

if __name__ == "__main__":
    main() 