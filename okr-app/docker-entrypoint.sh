#!/bin/sh
# Fix ownership of the data directory (bind mount may be owned by root)
chown -R ruok:nodejs /app/data

# Drop to non-root user and start the app
exec su-exec ruok node build
