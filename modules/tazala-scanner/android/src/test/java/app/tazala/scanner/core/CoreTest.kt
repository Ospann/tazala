package app.tazala.scanner.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.exp

class GrayImageTest {
  @Test(expected = IllegalArgumentException::class)
  fun rejectsMismatchedPixelCount() {
    GrayImage(2, 2, ByteArray(3))
  }

  @Test
  fun downscaleAveragesBlocks() {
    val image = GrayImage(2, 2, bytes(0, 100, 200, 100))
    assertEquals(100, image.resized(1, 1)[0, 0])
  }

  @Test
  fun fittingSizeKeepsAspectRatio() {
    assertEquals(Pair(256, 192), GrayImage.fittingSize(4000, 3000, 256))
    assertEquals(Pair(100, 50), GrayImage.fittingSize(100, 50, 256))
  }

  @Test
  fun convertsArgbToLuminance() {
    val gray = GrayImage.fromArgb(2, 1, intArrayOf(0xffffffff.toInt(), 0xff000000.toInt()))
    assertEquals(255, gray[0, 0])
    assertEquals(0, gray[1, 0])
  }
}

class ImageMetricsTest {
  @Test
  fun flatImageHasZeroLaplacianVariance() {
    val flat = GrayImage(16, 16, ByteArray(256) { 128.toByte() })
    assertEquals(0.0, ImageMetrics.laplacianVariance(flat), 0.0)
  }

  @Test
  fun sharpImageScoresHigherThanBlurred() {
    val sharp = TestImages.checkerboard(64, 2)
    val blurred = TestImages.boxBlur(sharp, 2)
    assertTrue(ImageMetrics.laplacianVariance(sharp) > ImageMetrics.laplacianVariance(blurred) * 4)
  }

  @Test
  fun dHashIsStableUnderBrightnessShift() {
    val base = TestImages.gradientNoise(128, 7)
    val brighter = TestImages.map(base) { minOf(it + 20, 255) }
    assertTrue(ImageMetrics.hammingDistance(ImageMetrics.dHash(base), ImageMetrics.dHash(brighter)) <= 4)
  }

  @Test
  fun dHashSeparatesDifferentImages() {
    val first = TestImages.gradientNoise(128, 1)
    val second = TestImages.map(TestImages.gradientNoise(128, 2)) { 255 - it }
    assertTrue(ImageMetrics.hammingDistance(ImageMetrics.dHash(first), ImageMetrics.dHash(second)) > 20)
  }

  @Test
  fun signatureRoundTrip() {
    val signature = ImageMetrics.signature(TestImages.gradientNoise(96, 3))
    assertEquals(256, signature.size)
    assertTrue(signature.contentEquals(ImageMetrics.decodeSignature(ImageMetrics.encodeSignature(signature))))
    assertNull(ImageMetrics.decodeSignature(ImageMetrics.encodeSignature(byteArrayOf(1, 2, 3))))
  }

  @Test
  fun hashRoundTrip() {
    val hash = 0x0123456789abcdefL
    assertEquals(hash, ImageMetrics.decodeHash(ImageMetrics.encodeHash(hash)))
    assertEquals(-1L, ImageMetrics.decodeHash(ImageMetrics.encodeHash(-1L)))
    assertNull(ImageMetrics.decodeHash("not base64!"))
    assertEquals(2, ImageMetrics.hammingDistance(0b1011, 0b0001))
  }
}

class SimilarityGrouperTest {
  @Test
  fun groupsSimilarItemsInsideWindow() {
    val grouper = SimilarityGrouper(600_000, 10)
    grouper.add(0, 0L)
    grouper.add(1_000, 0b111L)
    grouper.add(2_000, -1L)
    assertEquals(listOf(listOf(0, 1)), grouper.groups())
  }

  @Test
  fun ignoresSimilarItemsOutsideWindow() {
    val grouper = SimilarityGrouper(600_000, 10)
    grouper.add(0, 0L)
    grouper.add(600_001, 0L)
    assertEquals(emptyList<List<Int>>(), grouper.groups())
  }

  @Test
  fun doesNotChainThroughIntermediatePhotos() {
    val grouper = SimilarityGrouper(600_000, 4)
    grouper.add(0, 0L)
    grouper.add(10, 0b1111L)
    grouper.add(20, 0b11111111L)
    assertEquals(listOf(listOf(0, 1)), grouper.groups())
    assertEquals(2L, grouper.comparisons)
  }

  @Test
  fun joinsTheClosestSeries() {
    val grouper = SimilarityGrouper(600_000, 4)
    grouper.add(0, 0L)
    grouper.add(1, -1L)
    grouper.add(2, -2L)
    grouper.add(3, 1L)
    assertEquals(listOf(listOf(0, 3), listOf(1, 2)), grouper.groups())
  }

  @Test
  fun levelsAreOrderedBySensitivity() {
    assertTrue(SimilarityLevel.LOW.dhashThreshold < SimilarityLevel.MEDIUM.dhashThreshold)
    assertTrue(SimilarityLevel.MEDIUM.dhashThreshold < SimilarityLevel.HIGH.dhashThreshold)
    assertEquals(SimilarityLevel.MEDIUM, SimilarityLevel.parse("unknown"))
  }
}

class DuplicateGrouperTest {
  @Test
  fun toleranceAcceptsSmallNoiseAndRejectsEdits() {
    val base = ImageMetrics.signature(TestImages.gradientNoise(96, 5))
    val noisy = ByteArray(base.size) { ((base[it].toInt() and 0xff) + if (it % 3 == 0) 2 else -1).coerceIn(0, 255).toByte() }
    val brighter = ByteArray(base.size) { ((base[it].toInt() and 0xff) + 20).coerceIn(0, 255).toByte() }
    assertTrue(DuplicateTolerance.STANDARD.matches(base, noisy))
    assertTrue(!DuplicateTolerance.STANDARD.matches(base, brighter))
  }

  @Test
  fun groupsOnlySameDimensions() {
    val base = ImageMetrics.signature(TestImages.gradientNoise(96, 5))
    val other = ImageMetrics.signature(TestImages.gradientNoise(96, 9))
    val grouper = DuplicateGrouper()
    grouper.add(4032, 3024, base, 300.0)
    grouper.add(4032, 3024, other, 300.0)
    grouper.add(4032, 3024, base.copyOf(), 320.0)
    grouper.add(3024, 4032, base, 300.0)
    grouper.add(4032, 3024, base, 20.0)
    assertEquals(listOf(listOf(0, 2)), grouper.groups())
  }
}

private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }

private object TestImages {
  fun checkerboard(size: Int, cell: Int): GrayImage {
    val pixels = ByteArray(size * size)
    for (y in 0 until size) {
      for (x in 0 until size) {
        if (((x / cell) + (y / cell)) % 2 == 0) pixels[y * size + x] = 255.toByte()
      }
    }
    return GrayImage(size, size, pixels)
  }

  fun gradientNoise(size: Int, seed: Long): GrayImage {
    val random = java.util.Random(seed)
    val blobs = List(6) { Triple(random.nextDouble() * size, random.nextDouble() * size, random.nextDouble() * 255) }
    val pixels = ByteArray(size * size)
    for (y in 0 until size) {
      for (x in 0 until size) {
        var value = 0.0
        for ((bx, by, intensity) in blobs) {
          val dx = x - bx
          val dy = y - by
          value += intensity * exp(-(dx * dx + dy * dy) / (size * size / 8.0))
        }
        pixels[y * size + x] = minOf(value, 255.0).toInt().toByte()
      }
    }
    return GrayImage(size, size, pixels)
  }

  fun map(image: GrayImage, transform: (Int) -> Int): GrayImage =
    GrayImage(image.width, image.height, ByteArray(image.pixels.size) {
      transform(image.pixels[it].toInt() and 0xff).coerceIn(0, 255).toByte()
    })

  fun boxBlur(image: GrayImage, radius: Int): GrayImage {
    val output = ByteArray(image.pixels.size)
    for (y in 0 until image.height) {
      for (x in 0 until image.width) {
        var sum = 0
        var count = 0
        for (dy in -radius..radius) {
          for (dx in -radius..radius) {
            val sx = x + dx
            val sy = y + dy
            if (sx in 0 until image.width && sy in 0 until image.height) {
              sum += image[sx, sy]
              count++
            }
          }
        }
        output[y * image.width + x] = (sum / count).toByte()
      }
    }
    return GrayImage(image.width, image.height, output)
  }
}
