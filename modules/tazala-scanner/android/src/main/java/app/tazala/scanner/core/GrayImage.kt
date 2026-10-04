package app.tazala.scanner.core

import kotlin.math.max
import kotlin.math.roundToInt

class GrayImage(val width: Int, val height: Int, val pixels: ByteArray) {
  init {
    require(width > 0 && height > 0 && pixels.size == width * height) {
      "Invalid gray image ${width}x$height with ${pixels.size} pixels"
    }
  }

  operator fun get(x: Int, y: Int): Int = pixels[y * width + x].toInt() and 0xff

  fun resized(newWidth: Int, newHeight: Int): GrayImage {
    require(newWidth > 0 && newHeight > 0)
    val output = ByteArray(newWidth * newHeight)
    for (y in 0 until newHeight) {
      val sy0 = y * height / newHeight
      val sy1 = max(sy0 + 1, (y + 1) * height / newHeight)
      for (x in 0 until newWidth) {
        val sx0 = x * width / newWidth
        val sx1 = max(sx0 + 1, (x + 1) * width / newWidth)
        var sum = 0
        for (sy in sy0 until sy1) {
          val row = sy * width
          for (sx in sx0 until sx1) {
            sum += pixels[row + sx].toInt() and 0xff
          }
        }
        val count = (sy1 - sy0) * (sx1 - sx0)
        output[y * newWidth + x] = ((sum + count / 2) / count).toByte()
      }
    }
    return GrayImage(newWidth, newHeight, output)
  }

  companion object {
    fun fittingSize(width: Int, height: Int, maxSide: Int): Pair<Int, Int> {
      val longest = max(width, height)
      if (longest <= maxSide) {
        return Pair(max(width, 1), max(height, 1))
      }
      val scale = maxSide.toDouble() / longest
      return Pair(
        max((width * scale).roundToInt(), 1),
        max((height * scale).roundToInt(), 1),
      )
    }

    fun fromArgb(width: Int, height: Int, argb: IntArray): GrayImage {
      require(argb.size == width * height)
      val gray = ByteArray(argb.size)
      for (i in argb.indices) {
        val color = argb[i]
        val r = (color shr 16) and 0xff
        val g = (color shr 8) and 0xff
        val b = color and 0xff
        gray[i] = ((r * 299 + g * 587 + b * 114 + 500) / 1000).toByte()
      }
      return GrayImage(width, height, gray)
    }
  }
}
