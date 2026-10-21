FROM node:22-slim AS ui
WORKDIR /ui
COPY ui/package.json ./
RUN npm install --no-audit --no-fund
COPY ui/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY --from=ui /ui/dist ui/dist
ENV PORT=8000 DB_PATH=/tmp/vulcan.db
CMD ["sh", "-c", "gunicorn --chdir backend -b 0.0.0.0:${PORT} app:app"]
