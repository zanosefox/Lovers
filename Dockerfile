# Use Node.js 18 LTS (matches package.json engines requirement)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Set environment
ENV NODE_ENV=production
ENV PORT=8000

# Start the app
CMD ["node", "server.js"]
