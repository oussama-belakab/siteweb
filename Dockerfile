FROM python:3.12-slim
WORKDIR /app/website
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "web_server.py"]
