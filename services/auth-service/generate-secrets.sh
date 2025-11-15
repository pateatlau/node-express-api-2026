#!/bin/bash

# Generate Secure JWT Secrets
# This script generates cryptographically secure random secrets for JWT tokens

echo "🔐 Generating secure JWT secrets..."
echo ""

# Generate access token secret (64 bytes = 128 hex chars)
ACCESS_SECRET=$(openssl rand -hex 64)
echo "JWT_ACCESS_SECRET=$ACCESS_SECRET"
echo ""

# Generate refresh token secret (64 bytes = 128 hex chars)
REFRESH_SECRET=$(openssl rand -hex 64)
echo "JWT_REFRESH_SECRET=$REFRESH_SECRET"
echo ""

# Save to .env.secrets file (DO NOT COMMIT THIS FILE)
cat > .env.secrets << EOF
# Generated JWT Secrets - $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# Copy these values to your .env file

JWT_ACCESS_SECRET=$ACCESS_SECRET
JWT_REFRESH_SECRET=$REFRESH_SECRET
EOF

echo "✅ Secrets generated and saved to .env.secrets"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Copy the secrets from .env.secrets to your .env file"
echo "2. DO NOT commit .env.secrets to version control"
echo "3. Keep these secrets secure and never share them"
echo "4. Use different secrets for development and production"
echo ""
echo "🔒 These secrets are 128 characters long and cryptographically secure"
