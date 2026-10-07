# StoreForge — E-Commerce SaaS Backend

A multi-tenant e-commerce SaaS platform backend built with **Node.js**, **Express**, **Sequelize**, and **MySQL**. Store owners can register, subscribe to a package via manual payment verification, and run their own online store — with products, categories, orders, and sales reports. Customers can browse all stores, add products to cart, and pay online via **SSLCommerz**.

---

## 📚 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database](#-database)
- [Running the Server](#-running-the-server)
- [API Endpoints](#-api-endpoints)
- [Authentication & Roles](#-authentication--roles)
- [Payment Flow](#-payment-flow)
- [Multi-Tenancy](#-multi-tenancy)
- [SMS Integration](#-sms-integration)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

### Platform Level (Super Admin)
- **Package Management** — create, edit, activate/deactivate subscription plans with pricing, duration, and limits (max products, categories, orders)
- **Payment Channels** — configure bKash, Nagad, Rocket, and bank transfer accounts that store owners use for manual subscription payments
- **Manual Payment Verification** — review submitted transaction IDs, approve/reject, and activate stores with automatic SMS notification
- **Store Management** — view, activate, suspend, and manage all stores on the platform
- **Subscription & Billing** — full audit trail of every subscription, renewal, and cancellation
- **Store Owner Management** — list, create, edit, and delete store owners with their stores
- **Dashboard & Analytics** — platform-wide stats

### Store Owner Level
- **Store Dashboard** — overview of orders, revenue, and subscription status
- **Category Management** — add, edit, and organize product categories (unique per store)
- **Product Management** — add products with images, prices, stock, SKU, and tags (respects package limits)
- **Order Management** — receive orders, update status (Confirmed → Processing → Shipped → Delivered), track payment
- **Sales Reports** — revenue trends, top products, payment methods, sales by category
- **Store Settings** — update store branding, contact info, and social links

### Customer Level (Public)
- **Browse all stores** and their individual storefronts
- **Browse products** by store or by category
- **Search** across products
- **Guest checkout** — no account needed
- **Cart** (client-side, persisted across page reloads)
- **SSLCommerz payment** integration
- **Order confirmation** page

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MySQL |
| ORM | Sequelize |
| Auth | JWT (access + refresh tokens) |
| Password Hashing | bcryptjs |
| Payment Gateway | SSLCommerz (`sslcommerz-lts`) |
| SMS | Custom gateway (`msg.mram.com.bd`) |
| File Upload | Multer |
| Email | Nodemailer |
| Dev | Nodemon |

---

## 📁 Project Structure
