# Следующий этап: APK

Код интерфейса и БД уже общий для сайта и Android. Нативная оболочка ещё не создана: сначала проверить реальный Telegram-вход в браузере.

1. Установить Android Studio, Android SDK и JDK подходящих версий.
2. Добавить Capacitor из официального npm registry:

```sh
pnpm add @capacitor/core @capacitor/android @capacitor/app @capacitor/browser
pnpm add -D @capacitor/cli
pnpm build
pnpm exec cap add android
pnpm exec cap sync android
pnpm exec cap open android
```

3. Для Android заменить только адаптер авторизации: `signInWithOAuth` с `skipBrowserRedirect: true`, открыть полученный URL через Capacitor Browser (системный браузер), обработать `appUrlOpen` через Capacitor App.
4. Зарегистрировать уникальную схему `ritm://auth/callback` в AndroidManifest intent filter и разрешить этот redirect URL в Supabase Auth. Callback в Telegram по-прежнему остаётся HTTPS callback Supabase.
5. В обработчике проверять точные scheme/host/path входящей ссылки, извлечь одноразовый `code`, вызвать `supabase.auth.exchangeCodeForSession(code)` в том же WebView, где сохранён PKCE verifier, закрыть системный браузер. Код должен обмениваться ровно один раз.
6. Проверить холодный/тёплый старт и отмену входа на реальном устройстве, затем собрать debug APK в Android Studio. Для распространения использовать собственный release keystore и хранить его отдельно от проекта.

В APK не добавлять Bot Token, Client Secret или service_role. Только те же публичные Project URL и publishable key. Не загружать удалённый сайт в WebView вместо локальной сборки.
