# 🛒 Sumon Express — E-commerce Backend (REST API)

Production-grade e-commerce backend built with **Node.js, Express, MongoDB**.  
This is the full, industry-level version of my original *Sumon Express* prototype.

---

## 🚀 Tech Stack
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT (Access + Refresh Token)
- bcrypt
- Express Middleware Architecture

---

## 🧠 Features

### 🔐 Authentication & Security
- User registration & login
- Password hashing (bcrypt)
- JWT access token
- Refresh token with rotation
- httpOnly cookie
- Logout (refresh token revoke)
- Protected routes
- Role-based access (user/admin)
- Rate limiting
- Helmet security headers
- Central error handling

---

### 🛒 Product Management
- Admin create/update product
- Soft delete products
- Public product listing
- Pagination & sorting
- Stock safety (no negative stock)

---

### 🗂 Category System
- Admin create/update category
- Public category list
- Product-category population

---

### 📦 Order System
- Create order with stock validation
- Price snapshot at order time
- Automatic stock decrement
- User order history

---

### 🧑‍💼 Admin Management
- View all orders
- Update order status with lifecycle rules
- Admin order cancellation
- Strict business rule enforcement

---

### 🔁 Order Cancellation
- User cancel (pending/processing only)
- Admin override cancel
- Stock rollback on cancel
- Payment-ready architecture

---

## 🧱 Architecture Overview

Client (Web / API Client)
↓
Express Router
↓
Authentication Middleware (JWT)
↓
Role Middleware (Admin/User)
↓
Controller (Business Logic)
↓
Mongoose Models
↓
MongoDB Atlas (Cloud Database)


---

## 🧪 Testing
- Manual API testing using **Thunder Client**
- Tested authentication, role-based access, order lifecycle, and stock consistency
- Edge cases verified (double cancel, invalid role, insufficient stock)


---

## 🧑‍💻 Author
**Sumon Hossain**  
Backend-focused Full Stack Developer  
This project was built to deeply understand real-world backend architecture, not just for job preparation.

---

## 🔮 Future Improvements
- Payment gateway integration (Stripe / SSLCommerz)
- Refund handling with webhooks
- Frontend using React
- Automated testing (Jest + Supertest)
