# PlayCard Backend Server

![PlayCard System](image.png)

A robust Node.js backend server for the PlayCard RFID-based card management system. This server handles card transactions, player management, and real-time communication between ESP32 RFID readers and web clients.

## 🎯 System Overview

The PlayCard system is a comprehensive RFID card management solution consisting of:
- **ESP32 RFID Reader**: Hardware component for scanning RFID cards
- **Backend Server**: This Node.js/Express server handling business logic and data persistence
- **Web Frontend**: Admin dashboard and user interface for card management
- **MongoDB Database**: Persistent storage for cards, players, and transaction history

## 🏗️ Architecture

```
ESP32 RFID Reader → HTTP POST → Backend Server ← WebSocket ← Web Frontend
                                      ↓
                               MongoDB Database
```

**Component Responsibilities:**
- **ESP32**: Scans RFID cards and sends card IDs to the backend
- **Backend Server**: Processes transactions, manages player data, broadcasts updates
- **Web Frontend**: Provides admin interface for card management and monitoring
- **Database**: Stores card balances, player information, and transaction history

## ✨ Features

- **RFID Card Management**: Create, update, and track RFID card balances
- **Player Management**: Associate players with cards including contact information
- **Real-time Updates**: WebSocket integration for live scan notifications
- **Transaction History**: Complete audit trail of all card activities
- **Admin Search**: Advanced search functionality by card ID, player name, or phone
- **RESTful API**: Comprehensive REST endpoints for all operations
- **MongoDB Integration**: Persistent data storage with automatic card creation
- **CORS Support**: Cross-origin resource sharing for web client integration

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local installation or cloud service like MongoDB Atlas)
- **ESP32** with MFRC522 RFID module (for hardware integration)

## 🚀 Installation

1. **Clone the repository and navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Copy the environment template
   cp .env.example .env
   
   # Edit .env file with your configuration
   ```

## ⚙️ Configuration

Create a `.env` file in the server directory with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/playcard?retryWrites=true&w=majority

# Server Configuration
PORT=4000

# Optional: Add other environment-specific settings
NODE_ENV=development
```

**Configuration Options:**
- `MONGODB_URI`: Your MongoDB connection string (required)
- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment mode (development/production)

## 🏃‍♂️ Running the Server

### Development Mode
```bash
npm run dev
```
*Uses Node.js watch mode for automatic restarts on file changes*

### Production Mode
```bash
npm start
```

**Server Endpoints:**
- HTTP Server: `http://localhost:4000`
- WebSocket Server: `ws://localhost:4000/ws`

## 📡 API Documentation

### Health Check
```http
GET /health
```
**Response:** `200 OK` - Server health status

### Card Operations

#### Get Card Information
```http
GET /cards/:cardId
```
**Response:**
```json
{
  "_id": "abc123",
  "balance": 150,
  "status": "active",
  "player": {
    "name": "John Doe",
    "phone": "+1234567890",
    "notes": "Regular customer"
  },
  "history": [...]
}
```

#### Get Card History
```http
GET /cards/:cardId/history
```
**Response:** Array of transaction history entries

#### Recharge Card
```http
POST /cards/:cardId/recharge
Content-Type: application/json

{
  "amount": 100
}
```

#### Update Player Information
```http
PUT /cards/:cardId/player
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "+1234567890",
  "notes": "VIP customer"
}
```

### ESP32 Integration

#### RFID Scan Endpoint
```http
POST /esp/scan
Content-Type: application/json

{
  "cardId": "abc123"
}
```
*This endpoint is called by ESP32 devices when an RFID card is scanned*

### Admin Operations

#### Search Cards/Players
```http
GET /admin/search?type={id|name|phone}&query={searchTerm}
```
**Parameters:**
- `type`: Search type (id, name, or phone)
- `query`: Search term

## 🔄 WebSocket Events

The server broadcasts real-time events via WebSocket:

**Connection:** `ws://localhost:4000/ws`

**Events:**
- `card_scanned`: Triggered when ESP32 scans a card
- `balance_updated`: Triggered when card balance changes
- `player_updated`: Triggered when player information is modified

## 🧪 Testing

### Quick API Tests
```bash
# Health check
curl http://localhost:4000/health

# Get card information
curl http://localhost:4000/cards/ABC123

# Simulate ESP32 scan
curl -X POST http://localhost:4000/esp/scan \
  -H "Content-Type: application/json" \
  -d '{"cardId":"ABC123"}'

# Recharge card
curl -X POST http://localhost:4000/cards/ABC123/recharge \
  -H "Content-Type: application/json" \
  -d '{"amount":50}'
```

### WebSocket Testing
Use a WebSocket client or browser console:
```javascript
const ws = new WebSocket('ws://localhost:4000/ws');
ws.onmessage = (event) => console.log('Received:', event.data);
```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration:**
   ```bash
   NODE_ENV=production
   PORT=4000
   MONGODB_URI=your_production_mongodb_uri
   ```

2. **Process Management (PM2):**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name playcard-backend
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🛠️ Troubleshooting

### Common Issues

**MongoDB Connection Failed:**
- Verify `MONGODB_URI` in `.env` file
- Check network connectivity to MongoDB server
- Ensure database user has proper permissions

**ESP32 Cannot Connect:**
- Verify server is running on correct port
- Check firewall settings
- Ensure ESP32 and server are on same network

**WebSocket Connection Issues:**
- Verify WebSocket endpoint: `ws://localhost:4000/ws`
- Check for proxy/firewall blocking WebSocket connections
- Test with simple WebSocket client first

**Port Already in Use:**
```bash
# Find process using port 4000
netstat -ano | findstr :4000
# Kill the process or change PORT in .env
```

## 📝 Development Roadmap

### Immediate Improvements
- [ ] Input validation with Joi/Zod
- [ ] Rate limiting and security middleware
- [ ] Comprehensive error handling
- [ ] API response standardization

### Future Enhancements
- [ ] Authentication and authorization
- [ ] Transaction pagination
- [ ] Database backup strategies
- [ ] Monitoring and logging integration
- [ ] Multi-tenant support
- [ ] Mobile app API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the API documentation for proper usage
