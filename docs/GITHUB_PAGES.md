# Публикация Ритма на GitHub Pages

Репозиторий: https://github.com/h4cker3/h4cker3.github.io

Адрес сайта после успешного развёртывания: https://h4cker3.github.io/

## GitHub: выполнить один раз

1. Settings → Secrets and variables → Actions → **Variables** → New repository variable.
2. Добавить `VITE_SUPABASE_URL` со значением адреса своего проекта Supabase.
3. Добавить `VITE_SUPABASE_PUBLISHABLE_KEY` со значением **publishable** key (`sb_publishable_...`). Значения можно скопировать из локального `.env.local`.
4. Settings → Pages → Build and deployment → Source → **GitHub Actions**.
5. Actions → **Publish GitHub Pages** → Run workflow → main → Run workflow.
6. Дождаться зелёных build и deploy. Ссылка появится в Settings → Pages и в результате deploy.

После этого каждый push в main автоматически проверяет логику, собирает приложение и публикует `dist`.

Если автоматический запуск после загрузки через подключение GitHub не появился, ручной Run workflow запускает тот же процесс. Повторно запускать SQL для публикации не нужно.

## Supabase

Authentication → URL Configuration:

- **Site URL:** `https://h4cker3.github.io/`
- **Redirect URLs:** добавить `https://h4cker3.github.io/`.
- Для локальных тестов оставить `http://127.0.0.1:5173/` и `http://localhost:5173/`.

Сохранить. В обоих публичных адресах важно указать HTTPS и завершающий `/`.

## Telegram / BotFather

Для реализованного входа через Supabase Auth callback остаётся:

```text
https://sdcibpxxwpqqkglrfezu.supabase.co/auth/v1/callback
```

BotFather mini app → свой бот → Login Widget → Allowed URLs / Redirect URIs: этот точный callback должен оставаться разрешённым. Не заменять его адресом GitHub Pages: Telegram возвращает подтверждение в Supabase, а Supabase перенаправляет в приложение.

Если callback уже добавлен, в BotFather менять ничего не нужно. Client ID и Client Secret остаются в провайдере `custom:telegram` в Supabase. При прямом встраивании Telegram JS-виджета в будущем потребуются отдельные настройки origin; сейчас приложение использует перенаправление через Supabase.

## Что не публикуется

- `.env.local` и прочие локальные `.env*`, кроме пустого примера.
- Bot Token, Telegram Client Secret, Supabase secret/service_role и пароль БД.
- Локальная база демо, временные файлы, зависимости и кэши.

GitHub Actions получает только публичные параметры из repository variables. Сборка специально завершится ошибкой, если они не заданы или вместо publishable key подставлен другой тип ключа. Это предотвращает случайную публикацию демоверсии или привилегированного ключа.

`VITE_*` включаются в браузерный JavaScript. Перенос такого значения в GitHub Secrets не делает его секретным после сборки. Publishable key специально предназначен для этого; защиту данных обеспечивают сессия Supabase Auth, RLS и ограничения колонок. Серверные секреты должны оставаться в Supabase, их нельзя добавлять в переменные сборки.

## Проверка после публикации

1. Открыть https://h4cker3.github.io/ и пройти Telegram-вход.
2. После входа адрес должен вернуться на этот же сайт, без localhost.
3. Создать задачу и обновить страницу; проверить сохранение.
4. Войти с другого устройства/аккаунта и проверить вкладку друзей.

Демоданные и локальная тема с localhost не переносятся автоматически на другой origin. Задачи и профиль Supabase сохраняются в том же облачном проекте.

Документация:
- https://vite.dev/guide/static-deploy#github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://supabase.com/docs/guides/auth/redirect-urls
- https://core.telegram.org/bots/telegram-login
