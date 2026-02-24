#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Prediction Market Platform - Production Deployment Script
# ============================================================

EC2_HOST="16.171.76.19"
EC2_USER="root"
EC2_PASS="predmarket"
REMOTE_DIR="/opt/prediction-market"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"

echo "=========================================="
echo "  Prediction Market - Deploy to EC2"
echo "=========================================="

# ----------------------------------------------------------
# 1. Check prerequisites
# ----------------------------------------------------------
if ! command -v sshpass &> /dev/null; then
    echo "ERROR: sshpass is not installed."
    echo "Install it with:"
    echo "  macOS:  brew install hudochenkov/sshpass/sshpass"
    echo "  Ubuntu: sudo apt-get install sshpass"
    echo "  Fedora: sudo dnf install sshpass"
    exit 1
fi

if ! command -v rsync &> /dev/null; then
    echo "ERROR: rsync is not installed."
    exit 1
fi

echo "[1/6] Prerequisites OK"

# ----------------------------------------------------------
# 2. Sync project files to EC2
# ----------------------------------------------------------
echo "[2/6] Syncing project files to EC2..."

sshpass -p "${EC2_PASS}" rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.next' \
    --exclude 'coverage' \
    --exclude 'logs' \
    --exclude '.deploy-temp' \
    -e "ssh ${SSH_OPTS}" \
    ./ "${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/"

echo "    Files synced successfully."

# ----------------------------------------------------------
# 3. Install Docker on EC2 if not present
# ----------------------------------------------------------
echo "[3/6] Ensuring Docker is installed on EC2..."

sshpass -p "${EC2_PASS}" ssh ${SSH_OPTS} "${EC2_USER}@${EC2_HOST}" << 'INSTALL_DOCKER'
if ! command -v docker &> /dev/null; then
    echo "    Installing Docker..."
    apt-get update -qq
    apt-get install -y -qq docker.io docker-compose-plugin curl
    systemctl enable docker
    systemctl start docker
    echo "    Docker installed."
else
    echo "    Docker already installed."
fi

# Ensure docker compose plugin is available
if ! docker compose version &> /dev/null; then
    echo "    Installing Docker Compose plugin..."
    apt-get update -qq
    apt-get install -y -qq docker-compose-plugin
    echo "    Docker Compose plugin installed."
else
    echo "    Docker Compose plugin already available."
fi
INSTALL_DOCKER

# ----------------------------------------------------------
# 4. Stop existing containers
# ----------------------------------------------------------
echo "[4/6] Stopping existing containers..."

sshpass -p "${EC2_PASS}" ssh ${SSH_OPTS} "${EC2_USER}@${EC2_HOST}" << STOP_CMD
cd ${REMOTE_DIR}
docker compose -f docker-compose.prod.yml down || true
STOP_CMD

# ----------------------------------------------------------
# 5. Build and start production containers
# ----------------------------------------------------------
echo "[5/6] Building and starting production containers..."

sshpass -p "${EC2_PASS}" ssh ${SSH_OPTS} "${EC2_USER}@${EC2_HOST}" << START_CMD
cd ${REMOTE_DIR}
docker compose -f docker-compose.prod.yml up -d --build
START_CMD

echo "    Waiting 15 seconds for services to start..."
sleep 15

# ----------------------------------------------------------
# 6. Run database migrations and show status
# ----------------------------------------------------------
echo "[6/6] Running database migrations..."

sshpass -p "${EC2_PASS}" ssh ${SSH_OPTS} "${EC2_USER}@${EC2_HOST}" << MIGRATE_CMD
cd ${REMOTE_DIR}
docker exec prediction-market-backend npx prisma migrate deploy || echo "    Warning: Migration failed or no migrations to run."
MIGRATE_CMD

echo ""
echo "=========================================="
echo "  Container Status"
echo "=========================================="

sshpass -p "${EC2_PASS}" ssh ${SSH_OPTS} "${EC2_USER}@${EC2_HOST}" << STATUS_CMD
cd ${REMOTE_DIR}
docker compose -f docker-compose.prod.yml ps
STATUS_CMD

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "  Frontend:  http://${EC2_HOST}:3000"
echo "  Backend:   http://${EC2_HOST}:3001"
echo ""
echo "=========================================="
