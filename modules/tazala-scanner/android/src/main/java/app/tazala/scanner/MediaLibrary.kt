package app.tazala.scanner

import android.content.ContentResolver
import android.content.ContentUris
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore

data class MediaAsset(
  val id: Long,
  val isVideo: Boolean,
  val createdAt: Long,
  val modifiedAt: Long,
  val width: Int,
  val height: Int,
  val fileSize: Long,
  val durationMs: Long,
  val isScreenshot: Boolean,
  val isFavorite: Boolean,
) {
  val uri: Uri
    get() = MediaLibrary.contentUri(id, isVideo)

  fun toMap(): Map<String, Any?> {
    val estimated = fileSize <= 0
    val size = if (estimated) {
      if (isVideo) maxOf(durationMs / 1000.0, 1.0) * 1_500_000 else width.toDouble() * height * 0.3
    } else {
      fileSize.toDouble()
    }
    val result = mutableMapOf<String, Any?>(
      "id" to id.toString(),
      "uri" to uri.toString(),
      "mediaType" to if (isVideo) "video" else "photo",
      "createdAt" to createdAt.toDouble(),
      "modifiedAt" to modifiedAt.toDouble(),
      "width" to width,
      "height" to height,
      "fileSize" to size,
      "fileSizeEstimated" to estimated,
      "isScreenshot" to isScreenshot,
      "isFavorite" to isFavorite,
    )
    if (isVideo) {
      result["duration"] = durationMs / 1000.0
    }
    return result
  }
}

class MediaLibrary(private val resolver: ContentResolver) {
  fun stats(): Map<String, Int> = mapOf(
    "photoCount" to count(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE),
    "videoCount" to count(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO),
  )

  fun list(offset: Int, limit: Int): List<MediaAsset> =
    query(MEDIA_SELECTION, null, offset, limit)

  fun photos(ids: List<String>?): List<MediaAsset> {
    val photoSelection = "${MediaStore.Files.FileColumns.MEDIA_TYPE} = ${MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE}"
    val assets = if (ids == null) {
      query(photoSelection, null, 0, Int.MAX_VALUE)
    } else {
      ids.mapNotNull { it.toLongOrNull() }.chunked(CHUNK).flatMap { chunk ->
        query("$photoSelection AND ${MediaStore.Files.FileColumns._ID} IN (${chunk.joinToString(",")})", null, 0, Int.MAX_VALUE)
      }
    }
    return assets.sortedWith(compareBy({ it.createdAt }, { it.id }))
  }

  fun existing(ids: List<Long>): Map<Long, Boolean> {
    val found = mutableMapOf<Long, Boolean>()
    ids.chunked(CHUNK).forEach { chunk ->
      val selection = "$MEDIA_SELECTION AND ${MediaStore.Files.FileColumns._ID} IN (${chunk.joinToString(",")})"
      resolver.query(
        FILES_URI,
        arrayOf(MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.MEDIA_TYPE),
        selection,
        null,
        null,
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          found[cursor.getLong(0)] = cursor.getInt(1) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
        }
      }
    }
    return found
  }

  private fun count(mediaType: Int): Int =
    resolver.query(
      FILES_URI,
      arrayOf(MediaStore.Files.FileColumns._ID),
      "${MediaStore.Files.FileColumns.MEDIA_TYPE} = $mediaType",
      null,
      null,
    )?.use { it.count } ?: 0

  private fun query(selection: String, args: Array<String>?, offset: Int, limit: Int): List<MediaAsset> {
    val projection = buildList {
      add(MediaStore.Files.FileColumns._ID)
      add(MediaStore.Files.FileColumns.MEDIA_TYPE)
      add(COLUMN_DATE_TAKEN)
      add(MediaStore.MediaColumns.DATE_ADDED)
      add(MediaStore.MediaColumns.DATE_MODIFIED)
      add(MediaStore.MediaColumns.WIDTH)
      add(MediaStore.MediaColumns.HEIGHT)
      add(MediaStore.MediaColumns.SIZE)
      add(COLUMN_DURATION)
      add(COLUMN_ORIENTATION)
      add(COLUMN_BUCKET_DISPLAY_NAME)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        add(MediaStore.MediaColumns.RELATIVE_PATH)
      } else {
        add(COLUMN_DATA)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        add(MediaStore.MediaColumns.IS_FAVORITE)
      }
    }.toTypedArray()
    val sortOrder = "${MediaStore.Files.FileColumns._ID} ASC"
    val paged = offset > 0 || limit != Int.MAX_VALUE

    val cursor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val queryArgs = Bundle().apply {
        putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
        putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args)
        putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, sortOrder)
        if (paged) {
          putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
          putInt(ContentResolver.QUERY_ARG_OFFSET, offset)
        }
      }
      resolver.query(FILES_URI, projection, queryArgs, null)
    } else {
      val order = if (paged) "$sortOrder LIMIT $limit OFFSET $offset" else sortOrder
      resolver.query(FILES_URI, projection, selection, args, order)
    }
    return cursor?.use { readAssets(it) } ?: emptyList()
  }

  private fun readAssets(cursor: Cursor): List<MediaAsset> {
    val idIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
    val typeIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
    val takenIndex = cursor.getColumnIndex(COLUMN_DATE_TAKEN)
    val addedIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_ADDED)
    val modifiedIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_MODIFIED)
    val widthIndex = cursor.getColumnIndex(MediaStore.MediaColumns.WIDTH)
    val heightIndex = cursor.getColumnIndex(MediaStore.MediaColumns.HEIGHT)
    val sizeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)
    val durationIndex = cursor.getColumnIndex(COLUMN_DURATION)
    val orientationIndex = cursor.getColumnIndex(COLUMN_ORIENTATION)
    val bucketIndex = cursor.getColumnIndex(COLUMN_BUCKET_DISPLAY_NAME)
    val pathIndex = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH)
    } else {
      cursor.getColumnIndex(COLUMN_DATA)
    }
    val favoriteIndex = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      cursor.getColumnIndex(MediaStore.MediaColumns.IS_FAVORITE)
    } else {
      -1
    }

    val assets = ArrayList<MediaAsset>(cursor.count)
    while (cursor.moveToNext()) {
      val added = cursor.longOrZero(addedIndex) * 1000
      val taken = cursor.longOrZero(takenIndex)
      val modified = cursor.longOrZero(modifiedIndex) * 1000
      val orientation = cursor.intOrZero(orientationIndex)
      val rawWidth = cursor.intOrZero(widthIndex)
      val rawHeight = cursor.intOrZero(heightIndex)
      val rotated = orientation == 90 || orientation == 270
      val bucket = cursor.stringOrEmpty(bucketIndex)
      val path = cursor.stringOrEmpty(pathIndex)
      val createdAt = if (taken > 0) taken else added
      assets.add(
        MediaAsset(
          id = cursor.getLong(idIndex),
          isVideo = cursor.getInt(typeIndex) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO,
          createdAt = createdAt,
          modifiedAt = if (modified > 0) modified else createdAt,
          width = if (rotated) rawHeight else rawWidth,
          height = if (rotated) rawWidth else rawHeight,
          fileSize = cursor.longOrZero(sizeIndex),
          durationMs = cursor.longOrZero(durationIndex),
          isScreenshot = isScreenshotLocation(bucket, path),
          isFavorite = cursor.intOrZero(favoriteIndex) == 1,
        ),
      )
    }
    return assets
  }

  companion object {
    private const val CHUNK = 500
    private const val COLUMN_DATE_TAKEN = "datetaken"
    private const val COLUMN_DURATION = "duration"
    private const val COLUMN_ORIENTATION = "orientation"
    private const val COLUMN_BUCKET_DISPLAY_NAME = "bucket_display_name"
    private const val COLUMN_DATA = "_data"

    val FILES_URI: Uri = MediaStore.Files.getContentUri("external")

    val MEDIA_SELECTION =
      "${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (${MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE}, ${MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO})"

    fun contentUri(id: Long, isVideo: Boolean): Uri = ContentUris.withAppendedId(
      if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      id,
    )

    fun isScreenshotLocation(bucket: String, path: String): Boolean =
      bucket.contains("screenshot", ignoreCase = true) || path.contains("screenshot", ignoreCase = true)
  }
}

private fun Cursor.longOrZero(index: Int): Long = if (index < 0 || isNull(index)) 0 else getLong(index)

private fun Cursor.intOrZero(index: Int): Int = if (index < 0 || isNull(index)) 0 else getInt(index)

private fun Cursor.stringOrEmpty(index: Int): String = if (index < 0 || isNull(index)) "" else getString(index) ?: ""
