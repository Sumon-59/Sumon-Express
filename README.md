# 🛒 Sumon Express — Full-Stack E-commerce Application

A **production-ready full-stack e-commerce platform** built with modern web technologies, focusing on **real-world architecture, authentication, authorization, and business logic**.

---

## 🔗 Live Demo

- **Frontend (Vercel)**  
  https://sumon-express.vercel.app

- **Backend API (Render)**  
  https://sumon-express-backend.onrender.com

---

## 🧠 Project Motivation

This project was built to:

- Practice **full-stack architecture** (frontend + backend)
- Implement **cookie-based authentication** (industry standard)
- Handle **real e-commerce workflows** (cart → checkout → order)
- Understand **CORS, cookies, deployment, and environment configs**
- Prepare for **backend / full-stack interviews**

No tutorial copy–paste — everything was **implemented, debugged, and fixed manually**.

---

## 🏗️ Tech Stack

### Frontend
- Next.js (App Router)
- React 19
- TypeScript
- Tailwind CSS + shadcn/ui
- Axios (with credentials)
- Context API (Auth & Cart)

### Backend
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT (Access & Refresh Tokens)
- Cookie-based authentication
- Rate limiting & centralized error handling

### Deployment
- Frontend: **Vercel**
- Backend: **Render**
- Database: **MongoDB Atlas**

---

## 🔐 Authentication Flow

- Authentication via **HTTP-only cookies**
- Refresh token stored in cookie (`jwt`)
- `/api/auth/me` verifies logged-in user
- Protected routes secured via middleware
- Proper **CORS configuration** for cross-domain cookies

---

## ✨ Features

### ✅ Authentication
- Register
- Login
- Logout
- Persistent login using cookies
- Auth test page (`/test-auth`)

### ✅ Products
- Product listing
- Product details page
- Seeded demo products
- Active/inactive product handling

### ✅ Cart
- Add/remove products
- Quantity update
- Cart persistence via `localStorage`
- Global cart state using Context API

### ✅ Checkout & Orders
- Protected checkout
- Order creation
- Stock validation & update
- User order history
- Order cancellation with stock rollback

---

## 📂 Project Structure
```
Sumon-Express/
│
├── backend/
│ ├── server.js
│ ├── src/
│ │ ├── controllers/
│ │ ├── routes/
│ │ ├── models/
│ │ ├── middleware/
│ │ ├── seed/
│ │ └── config/
│
├── sumon-express-frontend/
│ ├── app/
│ ├── components/
│ ├── context/
│ ├── lib/
│ ├── types/
│ └── public/
│
└── README.md
```
---

## 🔑 API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout

### Products
- GET /api/products
- GET /api/products/:id

### Orders (Protected)
- POST /api/orders
- GET /api/orders/my-orders
- PUT /api/orders/:id/cancel

---

## 🛒 Order Payload Example

```json
{
  "items": [
    {
      "product": "PRODUCT_ID",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "address": "Dhaka",
    "city": "Dhaka"
  },
  "paymentMethod": "cod"
}
```
---
## ⚙️ Environment Variables
Frontend (.env.local)
```
NEXT_PUBLIC_API_BASE_URL=https://sumon-express-backend.onrender.com/api
```
Backend (Render)
```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
NODE_ENV=production
```
---
## 🚀 Run Locally
Backend
```
cd backend
npm install
npm run dev
```
Frontend
```
cd sumon-express-frontend
npm install
npm run dev
```
---
## 🧪 Demo Data
- Product data seeded via backend seed script
- No hardcoded frontend mock data
---
## 🔮 Future Improvements
- Product search, filter & pagination
- Admin dashboard
- Online payment gateway
- Order details page
- Image upload (Cloudinary / S3)
- Docker & CI/CD
- Redis caching
---
## 👨‍💻 Author
Md. Sumon Hossain
GitHub: https://github.com/Sumon-59
LinkedIn: https://www.linkedin.com/in/md-sumon-hossain-319a901b7/
