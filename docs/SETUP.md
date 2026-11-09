# Подключение Supabase и Telegram

Ни Bot Token, ни Client Secret присылать в чат не нужно. Их не должно быть в GitHub, `.env` фронтенда, APK, логах или скриншотах. Supabase — база PostgreSQL и сервер авторизации; GitHub Pages хранит только статические файлы приложения.

## 1. Создать проект Supabase

1. Зарегистрироваться на https://supabase.com/dashboard и создать проект.
2. Пароль БД сохранить в менеджере паролей. Он приложению не нужен.
3. Открыть SQL Editor и выполнить `supabase/migrations/202611090001_initial.sql` один раз, целиком.
4. В Project Settings → API / API Keys скопировать Project URL и **publishable key** (`sb_publishable_...`). Допустим старый `anon` key. Не брать `secret` / `service_role`.
5. Скопировать `.env.example` в `.env.local` в корне проекта:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_PUBLIC_VALUE
VITE_AUTH_PROVIDER=custom:telegram
```

Эти значения публичные и попадут в сборку. Это ожидаемо: доступ регулируют сессия пользователя и правила RLS. После изменения `.env.local` перезапустить `pnpm dev`; перед публикацией пересобрать сайт.

## 2. Создать бота Telegram

1. В https://t.me/BotFather отправить `/newbot`, выбрать имя и username.
2. Сохранить Bot Token отдельно. Для выбранного OIDC-входа он в приложении вообще не используется.
3. Открыть mini app BotFather → свой бот → Login Widget. Если показан старый виджет, выбрать Switch to OpenID Connect Login.
4. Получить **Client ID** и **Client Secret**. Это отдельные реквизиты, не Bot Token.

## 3. Подключить Telegram как провайдер Supabase

Supabase → Authentication → Sign In / Providers → Custom Providers → New Provider:

| Поле | Значение |
| --- | --- |
| Configuration method | Auto-discovery (OIDC) |
| Identifier | `custom:telegram` |
| Name | Telegram |
| Client ID | Из Login Widget в BotFather |
| Client Secret | Из Login Widget; вводить только здесь |
| Issuer URL | `https://oauth.telegram.org` |
| Scopes | `openid`, `profile` |
| Email optional | **true / включить**: Telegram не передаёт email |
| PKCE | Оставить включённым |

Скопировать Callback URL, который показывает форма Supabase. Обычно это `https://PROJECT_REF.supabase.co/auth/v1/callback`. В BotFather → Login Widget добавить этот точный адрес в Allowed URLs / Redirect URIs, затем создать и включить провайдер в Supabase. Не запрашивать телефон или право писать пользователю: для приложения они не нужны.

Если Email optional не показан в форме, провайдеру необходимо выставить `email_optional: true` через Auth Admin API, как в официальном примере Telegram. Привилегированный ключ использовать только в локальном административном скрипте/сервере; не добавлять его в Vite. Без этой настройки Telegram может не завершить регистрацию.

## 4. Разрешить возврат в приложение

Supabase → Authentication → URL Configuration:

- На время разработки Site URL: `http://127.0.0.1:5173/`.
- Redirect URLs: `http://127.0.0.1:5173/` и, если используешь localhost, `http://localhost:5173/`.
- Для тестирования сборки добавить `http://127.0.0.1:4173/`.
- При публикации Site URL: `https://h4cker3.github.io/` (для сайта в подпапке — точный URL с подпапкой).
- Добавить этот же точный публичный URL в Redirect URLs. Не использовать широкие wildcard-правила без необходимости.

В Telegram зарегистрирован callback Supabase, а в Supabase — адрес нашего приложения. Это два разных этапа возврата. Само приложение может быть локальным: сервер Supabase имеет публичный HTTPS callback.

## 5. Проверить

1. `pnpm dev`, открыть адрес, нажать «Войти через Telegram», подтвердить вход самостоятельно.
2. Убедиться, что появился пользователь в Authentication → Users и профиль в таблице `profiles`.
3. Создать задачу, изменить точный прогресс, обновить страницу — данные должны сохраниться в `tasks`.
4. Во втором браузере войти другим Telegram-аккаунтом. Через Supabase API второй пользователь должен читать задачи первого, но не менять/удалять их. Невошедший пользователь не должен читать ни `profiles`, ни `tasks`.
5. Проверить отказ при попытке записать отрицательный прогресс, цель 0, процентную цель не 100, чужой owner_id, изменить week_start или поля происхождения.
6. Для проверки переноса в тестовой БД создать прошлую незавершённую задачу через SQL Editor. Дважды вызвать `roll_week` под сессией её владельца: должен появиться ровно один новый экземпляр с тем же прогрессом. Завершённая задача не переносится.

## Где хранить значения

| Значение | Где хранить | Можно в браузер / GitHub Pages? |
| --- | --- | --- |
| Project URL, publishable / anon key | `.env.local`, переменные сборки | Да: это публичные значения |
| Telegram Client ID | Настройки провайдера Supabase | Не секрет, но клиенту здесь не нужен |
| Telegram Client Secret | Только Supabase Auth provider | Нет |
| Bot Token | Менеджер паролей / серверные секреты, если понадобится бот | Нет |
| Supabase secret / service_role | Только доверенный сервер / администрирование | Нет: обходит RLS |
| Пароль БД | Менеджер паролей | Нет |

`.gitignore` исключает `.env*`, кроме `.env.example`. Секрет нельзя спрятать минификацией JavaScript, закрытым репозиторием или упаковкой в APK. Если секрет попал в опубликованный код — отозвать/заменить его; удаления строки недостаточно.

Все зарегистрированные участники видят всех — по требованию проекта. Сейчас регистрация доступна любому, кто может пройти Telegram-вход. Если нужен закрытый круг по списку Telegram ID или приглашениям, это отдельное правило допуска, его нужно добавить на сервере до распространения ссылки.

## Официальная документация

- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://supabase.com/docs/guides/self-hosting/self-hosted-custom-oauth-providers (пример Telegram, включая `email_optional`)
- https://core.telegram.org/bots/telegram-login
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/api-keys
