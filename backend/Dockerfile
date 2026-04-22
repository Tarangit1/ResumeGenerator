FROM python:3.12-slim

# Install TeX Live (minimal + needed packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-fonts-recommended \
        texlive-fonts-extra \
        texlive-latex-recommended && \
    rm -rf /var/lib/apt/lists/*

# Install fontawesome5 (used by resume template)
RUN apt-get update && \
    apt-get install -y --no-install-recommends texlive-fonts-extra && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
