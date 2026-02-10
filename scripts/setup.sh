#!/bin/bash
# First-time setup
set -e

echo "🔧 Setting up inmobiliaria-system..."

# Check for .env
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  # Generate random passwords
  DB_PASS=$(openssl rand -hex 16)
  JWT_SEC=$(openssl rand -hex 32)
  sed -i "s/CHANGE_ME_STRONG_PASSWORD/$DB_PASS/" .env
  sed -i "s/CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32/$JWT_SEC/" .env
  echo "✅ .env created with random secrets"
  echo "⚠️  Review .env before starting!"
else
  echo "✅ .env already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install

echo ""
echo "✅ Setup complete! Next steps:"
echo "   1. Review .env file"
echo "   2. Run: bash scripts/dev.sh"
echo "   3. Or full Docker: docker compose up -d"
