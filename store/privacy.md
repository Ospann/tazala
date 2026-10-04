# Tazala — ответы для приватности в сторах

## App Store Connect → App Privacy

- **Data Collection:** «No, we do not collect data from this app».
- Итоговая карточка: **Data Not Collected**.
- Privacy manifest (`PrivacyInfo.xcprivacy`) генерируется из `app.config.ts → ios.privacyManifests`:
  - `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains = []`, `NSPrivacyCollectedDataTypes = []`.
  - `NSPrivacyAccessedAPITypes` приложения пустой; причины для required-reason API зависимостей (UserDefaults, file timestamp и т.п.) Expo агрегирует из манифестов подов (`apple.privacyManifestAggregationEnabled = true`). Перед отправкой проверить итоговый манифест в архиве: Xcode → Product → Archive → Generate Privacy Report.
- **Privacy Policy URL** обязателен: опубликуйте текст экрана «Политика конфиденциальности» (`src/i18n/*.json → privacy`) на любой статической странице и укажите ссылку.

## Google Play Console → Data safety

| Вопрос | Ответ |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Не применимо (данные не собираются и не передаются) |
| Do you provide a way for users to request that their data is deleted? | Не применимо; все данные локальные и удаляются вместе с приложением |

Обоснование: фото и видео обрабатываются только на устройстве, результаты хранятся в локальной SQLite. В release-сборке Android разрешение `INTERNET` удалено из манифеста (`android/app/src/release/AndroidManifest.xml` генерируется плагином в `app.config.ts`).

### Photo and Video Permissions (обязательная декларация Google Play)

Google Play разрешает `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` только приложениям, для которых широкий доступ к медиатеке — основная функция. Для Tazala это так: приложение анализирует всю галерею, чтобы найти похожие фото и дубликаты, — системный Photo Picker для этого не подходит.

Текст для формы декларации (en):
> Tazala is a gallery cleaner. Its core functionality is scanning the user's entire photo and video library on the device to find similar photos, exact duplicates, screenshots, blurry photos and large videos, and to delete the ones the user selects. This requires persistent read access to all images and videos; the Android photo picker only grants access to items picked one by one and cannot support library-wide analysis. All processing happens on the device; no media or data leaves the phone.

Также приложение поддерживает частичный доступ (`READ_MEDIA_VISUAL_USER_SELECTED`, Android 14+) и честно сообщает, что анализ будет неполным.

## Разрешения (итоговый список)

**iOS:** `NSPhotoLibraryUsageDescription` (полный доступ на чтение/запись к медиатеке; локализовано ru/kk/en).

**Android (release):**
- `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` (API 33+)
- `READ_MEDIA_VISUAL_USER_SELECTED` (API 34+, частичный доступ)
- `READ_EXTERNAL_STORAGE` (≤ API 32)
- `WRITE_EXTERNAL_STORAGE` (≤ API 29, удаление на Android 8–10)
- `VIBRATE` (хаптики)
- Удалены в release: `INTERNET`, `ACCESS_NETWORK_STATE`, `SYSTEM_ALERT_WINDOW`; заблокированы: `RECORD_AUDIO`, `ACCESS_MEDIA_LOCATION`.
