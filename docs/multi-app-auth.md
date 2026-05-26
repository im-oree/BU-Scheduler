# Multi-App Architecture Guide

This repository now includes a lightweight backend scaffold for the StudentHub multi-app auth model described in the product spec.

## What is included

- JWT sign-up and login endpoints
- App authorization and revocation
- Shared data reads for `profile`, `events`, `schedule`, `transactions`, `notifications`, and `wallet`
- Audit logging and share token endpoints
- Demo data to keep the API usable before a real StudentHub database is connected

## Backend endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/firebase-to-jwt`
- `POST /api/auth/authorize-app`
- `GET /api/auth/authorized-apps`
- `POST /api/auth/revoke-app`
- `GET /api/auth/verify`
- `GET /api/shared-data/:dataType`
- `POST /api/shared-data/snapshot`
- `GET /api/shared-data/audit-log`
- `POST /api/shared-data/share-token`
- `GET /api/shared-data/access/:token`
- `GET /api/shared-data/permissions`
- `POST /api/shared-data/permissions/grant`
- `POST /api/shared-data/permissions/revoke`

## Environment variables

Backend:

- `JWT_SECRET`
- `JWT_EXPIRY`
- `FRONTEND_URL`
- `FRONTEND_URL_PROD`
- `BACKEND_URL`
- `BACKEND_URL_PROD`
- `CORS_ORIGIN`
- `APP_NAME`

Frontend:

- `VITE_API_BASE_URL`
- `VITE_STUDENTHUB_API`

## Deployment

- Vercel serves the root frontend.
- Render serves the `/backend` API.
- Set `VITE_API_BASE_URL` on Vercel to the Render backend URL with `/api` appended.
- Set `CORS_ORIGIN` on Render to the Vercel domain.

## Current state

The backend uses in-memory demo records instead of Firestore. That keeps the repository deployable and validates the auth contract immediately. Swap the store implementation for Firestore or your canonical StudentHub database when you are ready to wire production persistence.
