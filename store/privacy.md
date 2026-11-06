# Tazala — ответы для приватности в сторах

## App Store Connect → App Privacy

- **Data Collection:** «Yes» — только через Google Mobile Ads SDK (неперсонализированная реклама, без ATT).
- Типы данных, все **Not Linked to You**, **Not Used for Tracking**, цель — Third-Party Advertising:
  - Identifiers → Device ID
  - Usage Data → Product Interaction, Advertising Data
  - Diagnostics → Performance Data, Crash Data (их собирает сам SDK; сверить с манифестом пода `Google-Mobile-Ads-SDK` в Privacy Report)
- Итоговая карточка: **Data Not Linked to You**.
- Privacy manifest (`PrivacyInfo.xcprivacy`) генерируется из `app.config.ts → ios.privacyManifests`:
  - `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains = []`; `NSPrivacyCollectedDataTypes` — Device ID, Product Interaction, Advertising Data (не связаны с пользователем, не трекинг, цель Third-Party Advertising).
  - `NSPrivacyAccessedAPITypes` приложения пустой; причины для required-reason API зависимостей (UserDefaults, file timestamp и т.п.) Expo агрегирует из манифестов подов (`apple.privacyManifestAggregationEnabled = true`). Перед отправкой проверить итоговый манифест в архиве: Xcode → Product → Archive → Generate Privacy Report.
- **Privacy Policy URL** обязателен: опубликуйте текст экрана «Политика конфиденциальности» (`src/i18n/*.json → privacy`) на любой статической странице и укажите ссылку.

## Google Play Console → Data safety

| Вопрос                                                                | Ответ                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?   | **Yes** (Google Mobile Ads SDK)                                                                                                                                                                                                             |
| Collected / shared                                                    | Device or other IDs (advertising ID, app set ID); App activity → App interactions; App info and performance → Crash logs, Diagnostics. Цель — Advertising or marketing, Analytics (как указывает Google для SDK); обработка эфемерная — нет |
| Is all of the user data collected by your app encrypted in transit?   | **Yes**                                                                                                                                                                                                                                     |
| Do you provide a way for users to request that their data is deleted? | Нет: данные, нужные для рекламы, обрабатывает Google; локальные данные удаляются вместе с приложением                                                                                                                                       |
| Contains ads                                                          | **Yes**                                                                                                                                                                                                                                     |

Обоснование: фото и видео обрабатываются только на устройстве, результаты хранятся в локальной SQLite. Сеть нужна только Google Mobile Ads SDK; запросы — только неперсонализированная реклама. Перед заполнением сверить с актуальной инструкцией Google «Google Mobile Ads SDK — Data disclosure».

### Photo and Video Permissions (обязательная декларация Google Play)

Google Play разрешает `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` только приложениям, для которых широкий доступ к медиатеке — основная функция. Для Tazala это так: приложение анализирует всю галерею, чтобы найти похожие фото и дубликаты, — системный Photo Picker для этого не подходит.

Текст для формы декларации (en):

> Tazala is a gallery cleaner. Its core functionality is scanning the user's entire photo and video library on the device to find similar photos, exact duplicates, screenshots, blurry photos and large videos, and to delete the ones the user selects. This requires persistent read access to all images and videos; the Android photo picker only grants access to items picked one by one and cannot support library-wide analysis. All processing happens on the device; no photos or videos leave the phone.

Также приложение поддерживает частичный доступ (`READ_MEDIA_VISUAL_USER_SELECTED`, Android 14+) и честно сообщает, что анализ будет неполным.

## Разрешения (итоговый список)

**iOS:** `NSPhotoLibraryUsageDescription` (полный доступ на чтение/запись к медиатеке; локализовано ru/kk/en).

**Android (release):**

- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` (API 33+)
- `READ_MEDIA_VISUAL_USER_SELECTED` (API 34+, частичный доступ)
- `READ_EXTERNAL_STORAGE` (≤ API 32)
- `WRITE_EXTERNAL_STORAGE` (≤ API 29, удаление на Android 8–10)
- `VIBRATE` (хаптики)
- `INTERNET`, `ACCESS_NETWORK_STATE`, `AD_ID` (Google Mobile Ads SDK)
- Удалено в release: `SYSTEM_ALERT_WINDOW`; заблокированы: `RECORD_AUDIO`, `ACCESS_MEDIA_LOCATION`.
