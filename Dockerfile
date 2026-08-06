FROM python:3.11-slim

# Install Node.js 18
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python Dependencies
COPY threat-engine/requirements.txt threat-engine/
RUN pip install --no-cache-dir -r threat-engine/requirements.txt

# Install Node Dependencies
COPY package.json ./
COPY orchestrator/package*.json orchestrator/
COPY dashboard/package*.json dashboard/
RUN npm run install

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Make start script executable
RUN chmod +x start.sh

# Expose standard Render port
EXPOSE 10000

# Start both services
CMD ["./start.sh"]
