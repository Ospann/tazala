# Tazala — чек-лист перед отправкой в сторы

Отметки: ✅ сделано в коде/конфиге · ⬜ требует действия перед релизом · ⚠️ риск, на который стоит обратить внимание.

## App Store Review Guidelines (утилиты)

- ✅ **1.1 / 2.3.1 Честные метаданные** — нет обещаний «ускорения», «очистки от вирусов», фейковых предупреждений; тексты в `store/listing.md`.
- ✅ **2.1 Полнота** — нет плейсхолдер-экранов, все кнопки работают; dev-экран бенчмарка скрыт в release (`__DEV__`).
- ✅ **2.3.3 Скриншоты** — показывают реальные экраны приложения (см. подсказки в `store/listing.md`).
- ✅ **2.5.1 Публичные API** — PhotoKit, Vision, PHAssetChangeRequest.
- ⚠️ **2.5.1** — размер файла ассета читается через `PHAssetResource.value(forKey: "fileSize")` (KVC, недокументированный ключ). Широко используется в аналогичных приложениях, но формально не публичный API. При отказе ревью — заменить на оценку по разрешению/длительности (код уже имеет fallback с флагом `fileSizeEstimated`).
- ✅ **3.1 Платежи** — приложение бесплатное, покупок нет.
- ✅ **4.0 Дизайн** — нативная навигация, поддержка тёмной темы, Dynamic Type (масштабирование шрифтов), VoiceOver-подписи.
- ✅ **4.2 Минимальная функциональность** — пять категорий, свайп-режим, корзина, пакетное удаление.
- ✅ **5.1.1 Сбор данных** — данные не собираются; запрос доступа к фото с понятным `NSPhotoLibraryUsageDescription` (ru/kk/en); корректная работа при limited и отказе.
- ✅ **5.1.1(iv)** — приложение не требует полного доступа: при limited объясняет ограничение и даёт сменить выбор.
- ✅ **5.1.2 Использование данных** — фото не покидают устройство.
- ✅ Privacy manifest, `ITSAppUsesNonExemptEncryption = false`.
- ⬜ Privacy Policy URL в App Store Connect.
- ⬜ Возрастной рейтинг: 4+ (нет пользовательского контента, сети, покупок).
- ⬜ Категория: Utilities (основная), Photo & Video (дополнительная).
- ⬜ Финальная иконка (сейчас плейсхолдер) и сплэш.
- ⬜ В заметках для ревьюера: «The app works fully offline. To test, allow access to the photo library; the analysis runs on device. Nothing is deleted without the system confirmation dialog.»

## Google Play

- ✅ Target API — по умолчанию Expo SDK 57 (актуальный targetSdk).
- ✅ Data safety — «No data collected» (`store/privacy.md`).
- ⬜ **Photo and Video Permissions declaration** — заполнить форму (текст в `store/privacy.md`). Без неё сборка с `READ_MEDIA_IMAGES` будет отклонена.
- ✅ Удаление только через системный `MediaStore.createDeleteRequest` (Android 11+) с подтверждением пользователя; на Android 8–10 — после подтверждения в приложении.
- ✅ Release-манифест без `INTERNET`.
- ⬜ Privacy Policy URL, контактный email разработчика.
- ⬜ Content rating questionnaire (IARC) — без насилия/UGC/покупок.
- ⬜ Подпись: Play App Signing + upload key (EAS создаст keystore при первой production-сборке).

## Сборка и версионирование

- ✅ `eas.json`: профили `development`, `development-simulator`, `preview`, `production`; `appVersionSource: remote` + `autoIncrement` для production.
- ✅ Версия приложения — `app.config.ts → version` (сейчас `1.0.0`). Номера сборок (`buildNumber` / `versionCode`) ведёт EAS.
- ✅ Bundle ID / applicationId — `app.tazala`, переопределяется переменной `TAZALA_APP_ID`.
- ⬜ `eas login`, `eas init` (привяжет projectId), затем `eas build --platform all --profile production` и `eas submit --profile production`.

## Ручная проверка перед релизом

- ⬜ iPhone среднего уровня и Android-телефон с 3–4 ГБ RAM, галерея ≥ 5 000 фото: время скана, память, адекватность групп (экран «Бенчмарк» в dev-сборке).
- ⬜ Калибровка порогов Vision на реальных сериях (утилита `tools/calibration`).
- ⬜ Удаление на iOS-устройстве (системное подтверждение, «Недавно удалённые»).
- ⬜ Android 10 (API 29) — путь `RecoverableSecurityException`.
- ⬜ Вычитка казахского перевода носителем (`src/i18n/kk.json → _needsNativeReview`, `store/listing.md`).
