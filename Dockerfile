# Use the official Node.js image as the base
FROM node:22-alpine AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the Astro project
RUN npm run build

# Use a lightweight web server for serving static files
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Expose the port Nginx runs on
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
