# HNG Shop Mobile App

Mobile app (Expo / React Native) for the HNG15 shop website:
https://hng15-shop-eight.vercel.app

## Features
- Google login using the same Supabase account as the website
- Cart synced with the website: items added on the website appear in the app live (Supabase Realtime)

## Tech
- Expo (React Native)
- Supabase (Auth, Postgres, Realtime)

## Run it
1. Install dependencies: `npm install`
2. Start the app: `npx expo start --tunnel`
3. Open it with the Expo Go app on your phone

## Supabase setup
- Table: `cart_items` with Row Level Security (each user sees only their own items)
- Realtime enabled on `cart_items`
- Redirect URL `exp://**` allowed in Authentication, URL Configuration

## Tested
Tested on a physical phone: login with the same account on website and app, and cart sync from website to app.