package app.tazala.scanner

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Size
import app.tazala.scanner.core.FINGERPRINT_KIND_DHASH
import app.tazala.scanner.core.GrayImage
import app.tazala.scanner.core.ImageMetrics
import java.io.FileNotFoundException

class AssetAnalyzer(private val resolver: ContentResolver) {
  fun analyze(asset: MediaAsset): Map<String, Any?> {
    val gray = try {
      loadGray(asset)
    } catch (_: FileNotFoundException) {
      null
    } catch (_: SecurityException) {
      null
    } catch (_: OutOfMemoryError) {
      null
    } catch (_: Exception) {
      null
    }
    if (gray == null) {
      return failed(asset)
    }
    return mapOf(
      "id" to asset.id.toString(),
      "status" to "ok",
      "fingerprint" to ImageMetrics.encodeHash(ImageMetrics.dHash(gray)),
      "fingerprintKind" to FINGERPRINT_KIND_DHASH,
      "blurScore" to ImageMetrics.laplacianVariance(gray),
      "exactHash" to ImageMetrics.encodeSignature(ImageMetrics.signature(gray)),
      "analysisVersion" to ANALYSIS_VERSION,
    )
  }

  private fun failed(asset: MediaAsset): Map<String, Any?> = mapOf(
    "id" to asset.id.toString(),
    "status" to "failed",
    "fingerprint" to null,
    "fingerprintKind" to null,
    "blurScore" to 0.0,
    "exactHash" to "",
    "analysisVersion" to ANALYSIS_VERSION,
  )

  private fun loadGray(asset: MediaAsset): GrayImage? {
    val thumbnail = loadThumbnail(asset) ?: return null
    try {
      val (width, height) = GrayImage.fittingSize(thumbnail.width, thumbnail.height, ImageMetrics.ANALYSIS_MAX_SIDE)
      val scaled = if (width == thumbnail.width && height == thumbnail.height) {
        thumbnail
      } else {
        Bitmap.createScaledBitmap(thumbnail, width, height, true)
      }
      try {
        val argb = IntArray(width * height)
        scaled.getPixels(argb, 0, width, 0, 0, width, height)
        return GrayImage.fromArgb(width, height, argb)
      } finally {
        if (scaled !== thumbnail) {
          scaled.recycle()
        }
      }
    } finally {
      thumbnail.recycle()
    }
  }

  private fun loadThumbnail(asset: MediaAsset): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      return resolver.loadThumbnail(asset.uri, Size(THUMBNAIL_SIDE, THUMBNAIL_SIDE), null)
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(asset.uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      return null
    }
    var sampleSize = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sampleSize * 2) >= THUMBNAIL_SIDE) {
      sampleSize *= 2
    }
    val options = BitmapFactory.Options().apply {
      inSampleSize = sampleSize
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return resolver.openInputStream(asset.uri)?.use { BitmapFactory.decodeStream(it, null, options) }
  }

  companion object {
    const val ANALYSIS_VERSION = 1
    private const val THUMBNAIL_SIDE = 300
  }
}
