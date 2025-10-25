# NewsHub Backend API

A Node.js/Express backend API for the NewsHub application, providing news scraping, article management, and admin functionality.

## 🚀 Features

- **News Scraping**: Automated RSS feed parsing and web scraping
- **Article Management**: CRUD operations for articles and categories
- **Admin Dashboard**: User authentication and content management
- **Real-time Updates**: WebSocket support for live data
- **Job Queue**: Background processing with BullMQ
- **API Documentation**: Swagger/OpenAPI integration

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis
- **Queue**: BullMQ
- **Authentication**: JWT
- **Documentation**: Swagger
- **Testing**: Jest
- **TypeScript**: Full type safety

## 📋 Prerequisites

- Node.js 18+
- MongoDB
- Redis
- npm or yarn

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 🌐 API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/articles` - Get articles
- `GET /api/categories` - Get categories
- `GET /api/news` - Get latest news

### Admin Endpoints
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/articles` - Get all articles
- `POST /api/admin/articles` - Create article
- `PUT /api/admin/articles/:id` - Update article
- `DELETE /api/admin/articles/:id` - Delete article

## 🗄️ Database Schema

### Articles
- `title`: Article title
- `content`: Article content
- `summary`: Article summary
- `url`: Original article URL
- `source`: Source website
- `category`: Article category
- `publishedAt`: Publication date
- `createdAt`: Creation timestamp

### Categories
- `name`: Category name
- `slug`: URL-friendly identifier
- `description`: Category description

## 🔐 Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/newshub
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Server
PORT=3001
NODE_ENV=development

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpass

# Scraping
SCRAPING_ENABLED=true
SCRAPING_INTERVAL=30
MAX_CONCURRENT_SCRAPERS=5
```

## 🚀 Deployment

### Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

### Docker
```bash
docker build -t newshub-backend .
docker run -p 3001:3001 newshub-backend
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/api.test.ts
```

## 📚 API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs.json`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.