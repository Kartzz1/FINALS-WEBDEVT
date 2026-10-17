# FINALS-WEBDEVT

The application is in [`restaurant-reservation-system/`](./restaurant-reservation-system/).
The repository root is an npm workspace so deployment platforms such as Render can
install and start the backend from the repository root:

- Build/install command: `npm install`
- Backend start command: `npm start`
- Frontend build command: `npm run build`

For a Render web service, set the backend environment variables documented in
[`restaurant-reservation-system/README.md`](./restaurant-reservation-system/README.md),
including `NODE_ENV=production`, `STORAGE_MODE=mongo`, `MONGODB_URI`,
`JWT_SECRET`, and `CLIENT_URL`. For a separate frontend static site, set
`VITE_API_URL` to the deployed backend origin and publish
`restaurant-reservation-system/frontend/dist`.