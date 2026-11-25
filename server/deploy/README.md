# Деплой API

Юнит `tododesk-api.service` запускает процесс от пользователя `tododesk`, не от root. Один раз на хосте, до перезапуска с этим юнитом:

```bash
sudo groupadd --system tododesk || true
id tododesk >/dev/null 2>&1 || sudo useradd --system --gid tododesk --home-dir /opt/tododesk --shell /usr/sbin/nologin --no-create-home tododesk

sudo mkdir -p /opt/tododesk/api /opt/tododesk/uploads
sudo chown -R tododesk:tododesk /opt/tododesk
# Снимает доступ «для всех», включая 777. Каталоги и файлы с битом выполнения — 750, остальные файлы — 640.
sudo chmod -R u=rwX,g=rX,o= /opt/tododesk
if [ -f /opt/tododesk/.env ]; then sudo chmod 600 /opt/tododesk/.env; fi

sudo cp server/deploy/tododesk-api.service /etc/systemd/system/tododesk-api.service
sudo systemctl daemon-reload
sudo systemctl restart tododesk-api
```

`cp` — из каталога репозитория. Если юнит на сервере уже лежит в другом пути systemd, обновите тот файл содержимым `server/deploy/tododesk-api.service` и всё равно выполните `daemon-reload`.

`TRUST_PROXY` — адреса прокси через запятую (формат proxy-addr). По умолчанию `127.0.0.1`. Если nginx подключается по IPv6 loopback, задайте `TRUST_PROXY=127.0.0.1,::1`.

Не перезапускайте сервис, пока нет пользователя `tododesk` и каталога `/opt/tododesk/uploads`. Иначе старт падает: нет пользователя (`217/USER`) или `ProtectSystem=strict` не может смонтировать несуществующий `ReadWritePaths` (`226/NAMESPACE`).

Процесс пишет на диск только вложения. Каталог по умолчанию — `/opt/tododesk/uploads` (переменная `UPLOAD_DIR`). Остальная ФС для него только для чтения (`ProtectSystem=strict`), временные файлы — в своём `/tmp` (`PrivateTmp`). Postgres к этому юниту не относится. Если задаёте другой `UPLOAD_DIR`, создайте каталог, отдайте его `tododesk:tododesk` и допишите путь в `ReadWritePaths=`.

## Прокси и лимит входа

`server/deploy/nginx.conf` уже передаёт адрес клиента:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Менять nginx не нужно, если боевой конфиг совпадает с файлом в репозитории. API доверяет `X-Forwarded-For` только от пира из `TRUST_PROXY` (по умолчанию `127.0.0.1` — nginx на этой же машине). Лимит входа ключуется по этому адресу, а не по `127.0.0.1` для всех сразу.
