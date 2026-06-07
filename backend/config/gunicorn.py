"""Gunicorn configuration file for production"""
import multiprocessing
import os

# Server socket — bind é sobrescrito pelo deploy.sh via flag --bind
gunicorn_host = os.getenv('GUNICORN_HOST', '0.0.0.0')
gunicorn_port = os.getenv('GUNICORN_PORT', '8000')
bind = f"{gunicorn_host}:{gunicorn_port}"
backlog = 2048

# Worker processes — cpu_count*2+1 é o padrão recomendado pelo Gunicorn
# Em t3.micro (1 vCPU) = 3 workers; t3.small (2 vCPU) = 5 workers
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging — deploy.sh sobrescreve com paths dos arquivos de log
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "registraponto"

# Server mechanics — daemon=False permite que deploy.sh controle via --daemon flag
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (se necessário)
# keyfile = "/path/to/key.pem"
# certfile = "/path/to/cert.pem"
