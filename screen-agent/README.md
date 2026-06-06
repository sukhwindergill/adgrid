# Screen Agent

The screen agent runs three services that work together to capture video, run inference models, and push results:

- **Camera Service**: Captures video frames from a USB camera connected at `/dev/video0`
- **Inference Service**: Runs ML models to analyze the video frames
- **Pusher Service**: Sends inference results back to the platform in real-time

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required environment variables in `.env`:
   - `SCREEN_TOKEN`: Get this from the Setup Guide tab on your screen's detail page
   - `SUPABASE_URL`: Already populated with the correct URL
   - `SUPABASE_ANON_KEY`: Get this from the platform or the Setup Guide

3. Start the services:
   ```bash
   docker-compose up -d
   ```

## Requirements

- **Docker**: Make sure Docker and Docker Compose are installed
- **USB Camera**: A USB camera connected at `/dev/video0` (Linux) or equivalent on other systems
