# FINALS-WEBDEVT

The application is in [`restaurant-reservation-system/`](./restaurant-reservation-system/).
The repository root is an npm workspace so deployment platforms such as Render can
install and start the backend from the repository root. A Render Blueprint is
provided in [`render.yaml`](./render.yaml).

To deploy the backend, create a MongoDB Atlas database, then in Render choose
**New > Blueprint** and select this GitHub repository. Enter the Atlas connection
string as `MONGODB_URI` when prompted; keep it private. The blueprint configures
the other production settings and the backend health check.

After Render creates the service, copy its public URL into the Vercel project's
`VITE_API_URL` environment variable (without a trailing slash), then redeploy the
frontend. The Vercel origin is already configured as the backend's `CLIENT_URL`.
New users can register from the website; logins only work for accounts already
registered in the connected database.

The `MONGODB_URI` must point to a MongoDB Atlas cluster with network access enabled
for Render. See [MongoDB setup](./restaurant-reservation-system/README.md#setting-up-mongodb-needed-to-keep-data)
for the database setup details. For local development, the existing app instructions
remain in [`restaurant-reservation-system/README.md`](./restaurant-reservation-system/README.md).