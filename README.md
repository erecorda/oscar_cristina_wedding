# Guía de despliegue

- Hosting: **Hetzner Cloud CX22** (aprox 4-6 €/mes)
- Dominio: **Namecheap** o **Cloudflare Registrar** (aprox 8-15 €/año)

---

## Paso 0: qué necesitas

- Una cuenta en GitHub con este proyecto subido
- Tarjeta para pagar hosting/dominio
- 30-45 min

---

## Paso 1: comprar dominio

1. Compra un dominio (ejemplo: `crisyoscar.com`) en Namecheap/Cloudflare.
2. Déjalo apuntando con sus DNS por defecto (luego lo cambiamos).

---

## Paso 2: crear servidor barato en Hetzner

1. Entra en Hetzner Cloud.
2. Crea un servidor:
   - Imagen: `Ubuntu 24.04`
   - Plan: `CX22`
   - Región: la más cercana
3. Activa `IPv4`.
4. Copia la IP pública del servidor.

---

## Paso 3: conectar al servidor

En tu terminal local:

```bash
ssh root@TU_IP_DEL_SERVIDOR
```

---

## Paso 4: instalar Node, Git y PM2

En el servidor:

```bash
apt update && apt upgrade -y
apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

Comprobar:

```bash
node -v
npm -v
```

---

## Paso 5: subir y arrancar el proyecto

En el servidor:

```bash
cd /opt
git clone https://github.com/TU_USUARIO/TU_REPO.git oscar-cris
cd oscar-cris
npm install
pm2 start server.js --name boda
pm2 save
pm2 startup
```

Comprobar que responde:

```bash
curl http://localhost:3000
```

---

## Paso 6: instalar Nginx (para dominio + HTTPS)

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Crear config:

```bash
cat > /etc/nginx/sites-available/boda <<'NGINX'
server {
  listen 80;
  server_name tudominio.com www.tudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX

ln -s /etc/nginx/sites-available/boda /etc/nginx/sites-enabled/boda
nginx -t
systemctl restart nginx
```

---

## Paso 7: apuntar el dominio al servidor

En el panel del dominio, crea:

- Registro `A` para `@` -> `TU_IP_DEL_SERVIDOR`
- Registro `A` para `www` -> `TU_IP_DEL_SERVIDOR`

Espera propagación (5 min a 2 h).

---

## Paso 8: activar HTTPS

En el servidor:

```bash
certbot --nginx -d tudominio.com -d www.tudominio.com
```

Elige redirección automática a HTTPS cuando lo pregunte.

---

## Paso 9: dónde se guardan las respuestas

El formulario guarda en:

`/opt/oscar-cris/base_datos_asistencia.xlsx`

---

## Paso 10: copia de seguridad (muy importante)

Haz copia diaria del Excel:

```bash
cp /opt/oscar-cris/base_datos_asistencia.xlsx /opt/oscar-cris/backup_$(date +%F).xlsx
```

(ideal: programarlo con `cron`)

---

## Actualizar la web cuando cambies algo

En el servidor:

```bash
cd /opt/oscar-cris
git pull
npm install
pm2 restart boda
```

---

## Problemas típicos

- No abre el dominio: revisa DNS `A` apuntando a la IP.
- No carga HTTPS: ejecuta de nuevo `certbot --nginx ...`.
- Formulario no guarda: mira logs:

```bash
pm2 logs boda
```

---

## Coste aproximado

- Servidor: 4-6 €/mes
- Dominio: 8-15 €/año

