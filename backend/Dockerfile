FROM python:3.11-slim

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir uv && uv pip install --system --no-cache -r requirements.txt

EXPOSE 8008

# RUN python3 database.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008", "--log-config", "log-config.json"]