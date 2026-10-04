package app.tazala.scanner.core

import java.util.Base64

object ImageMetrics {
  const val ANALYSIS_MAX_SIDE = 256

  fun laplacianVariance(image: GrayImage): Double {
    val width = image.width
    val height = image.height
    if (width < 3 || height < 3) {
      return 0.0
    }
    val pixels = image.pixels
    var sum = 0.0
    var sumOfSquares = 0.0
    for (y in 1 until height - 1) {
      val row = y * width
      for (x in 1 until width - 1) {
        val center = pixels[row + x].toInt() and 0xff
        val value = (pixels[row - width + x].toInt() and 0xff) +
          (pixels[row + width + x].toInt() and 0xff) +
          (pixels[row + x - 1].toInt() and 0xff) +
          (pixels[row + x + 1].toInt() and 0xff) - 4 * center
        val v = value.toDouble()
        sum += v
        sumOfSquares += v * v
      }
    }
    val count = ((width - 2) * (height - 2)).toDouble()
    val mean = sum / count
    return maxOf(sumOfSquares / count - mean * mean, 0.0)
  }

  fun dHash(image: GrayImage): Long {
    val small = image.resized(9, 8)
    var hash = 0L
    for (y in 0 until 8) {
      for (x in 0 until 8) {
        hash = hash shl 1
        if (small[x, y] > small[x + 1, y]) {
          hash = hash or 1L
        }
      }
    }
    return hash
  }

  const val SIGNATURE_SIDE = 16

  fun signature(image: GrayImage): ByteArray = image.resized(SIGNATURE_SIDE, SIGNATURE_SIDE).pixels

  fun encodeSignature(signature: ByteArray): String = Base64.getEncoder().encodeToString(signature)

  fun decodeSignature(encoded: String): ByteArray? {
    val bytes = try {
      Base64.getDecoder().decode(encoded)
    } catch (_: IllegalArgumentException) {
      return null
    }
    return if (bytes.size == SIGNATURE_SIDE * SIGNATURE_SIDE) bytes else null
  }

  fun hammingDistance(a: Long, b: Long): Int = java.lang.Long.bitCount(a xor b)

  fun encodeHash(hash: Long): String {
    val bytes = ByteArray(8) { index -> (hash ushr (56 - index * 8)).toByte() }
    return Base64.getEncoder().encodeToString(bytes)
  }

  fun decodeHash(encoded: String): Long? {
    val bytes = try {
      Base64.getDecoder().decode(encoded)
    } catch (_: IllegalArgumentException) {
      return null
    }
    if (bytes.size != 8) {
      return null
    }
    return bytes.fold(0L) { acc, byte -> (acc shl 8) or (byte.toLong() and 0xff) }
  }
}
