import XCTest

@testable import TazalaScannerCore

final class GrayImageTests: XCTestCase {
  func testRejectsMismatchedPixelCount() {
    XCTAssertNil(GrayImage(width: 2, height: 2, pixels: [0, 0, 0]))
  }

  func testDownscaleAveragesBlocks() {
    let image = GrayImage(width: 2, height: 2, pixels: [0, 100, 200, 100])!
    XCTAssertEqual(image.resized(width: 1, height: 1).pixels, [100])
  }

  func testFittingSizeKeepsAspectRatio() {
    let size = GrayImage.fittingSize(width: 4000, height: 3000, maxSide: 256)
    XCTAssertEqual(size.width, 256)
    XCTAssertEqual(size.height, 192)
  }
}

final class ImageMetricsTests: XCTestCase {
  func testFlatImageHasZeroLaplacianVariance() {
    let flat = GrayImage(width: 16, height: 16, pixels: [UInt8](repeating: 128, count: 256))!
    XCTAssertEqual(ImageMetrics.laplacianVariance(flat), 0)
  }

  func testSharpImageScoresHigherThanBlurred() {
    let sharp = TestImages.checkerboard(size: 64, cell: 2)
    let blurred = TestImages.boxBlur(sharp, radius: 2)
    XCTAssertGreaterThan(ImageMetrics.laplacianVariance(sharp), ImageMetrics.laplacianVariance(blurred) * 4)
  }

  func testDHashIsStableUnderBrightnessShift() {
    let base = TestImages.gradientNoise(size: 128, seed: 7)
    let brighter = TestImages.map(base) { min(Int($0) + 20, 255) }
    XCTAssertLessThanOrEqual(ImageMetrics.hammingDistance(ImageMetrics.dHash(base), ImageMetrics.dHash(brighter)), 4)
  }

  func testDHashSeparatesDifferentImages() {
    let first = TestImages.gradientNoise(size: 128, seed: 1)
    let second = TestImages.map(TestImages.gradientNoise(size: 128, seed: 2)) { 255 - Int($0) }
    XCTAssertGreaterThan(ImageMetrics.hammingDistance(ImageMetrics.dHash(first), ImageMetrics.dHash(second)), 20)
  }

  func testSignatureRoundTrip() {
    let image = TestImages.gradientNoise(size: 96, seed: 3)
    let signature = ImageMetrics.signature(image)
    XCTAssertEqual(signature.count, 256)
    XCTAssertEqual(ImageMetrics.decodeSignature(ImageMetrics.encodeSignature(signature)), signature)
    XCTAssertNil(ImageMetrics.decodeSignature(ImageMetrics.encodeSignature([1, 2, 3])))
  }

  func testHashRoundTrip() {
    let hash: UInt64 = 0x0123_4567_89ab_cdef
    XCTAssertEqual(ImageMetrics.decodeHash(ImageMetrics.encodeHash(hash)), hash)
    XCTAssertEqual(ImageMetrics.hammingDistance(0b1011, 0b0001), 2)
  }
}

final class FeatureVectorTests: XCTestCase {
  func testRoundTripWithinHalfPrecision() {
    let values: [Float] = [0, 0.5, -0.25, 0.123_456, 1.5]
    let decoded = FeatureVector.decode(FeatureVector.encode(values))!
    for (original, restored) in zip(values, decoded) {
      XCTAssertEqual(original, restored, accuracy: 0.001)
    }
  }

  func testRejectsDegenerateVectors() {
    XCTAssertFalse(FeatureVector.isInformative([0, 0, 0]))
    XCTAssertFalse(FeatureVector.isInformative([1, .nan]))
    XCTAssertTrue(FeatureVector.isInformative([0.1, -0.2, 0.3]))
  }

  func testEuclideanDistance() {
    XCTAssertEqual(FeatureVector.distance([0, 0], [3, 4]), 5, accuracy: 0.0001)
    XCTAssertEqual(FeatureVector.distance([1], [1, 2]), .infinity)
  }
}

final class SimilarityGrouperTests: XCTestCase {
  private let thresholds = SimilarityThresholds(vision: 0.5, dhash: 10)

  func testGroupsSimilarItemsInsideWindow() {
    var grouper = SimilarityGrouper(windowMs: 600_000, thresholds: thresholds)
    grouper.add(createdAt: 0, fingerprint: .dhash(0))
    grouper.add(createdAt: 1_000, fingerprint: .dhash(0b111))
    grouper.add(createdAt: 2_000, fingerprint: .dhash(UInt64.max))
    XCTAssertEqual(grouper.groups(), [[0, 1]])
  }

  func testIgnoresSimilarItemsOutsideWindow() {
    var grouper = SimilarityGrouper(windowMs: 600_000, thresholds: thresholds)
    grouper.add(createdAt: 0, fingerprint: .dhash(0))
    grouper.add(createdAt: 600_001, fingerprint: .dhash(0))
    XCTAssertEqual(grouper.groups(), [])
  }

  func testDoesNotChainThroughIntermediatePhotos() {
    var grouper = SimilarityGrouper(windowMs: 600_000, thresholds: thresholds)
    grouper.add(createdAt: 0, fingerprint: .vision([0, 0]))
    grouper.add(createdAt: 10, fingerprint: .vision([0.4, 0]))
    grouper.add(createdAt: 20, fingerprint: .vision([0.8, 0]))
    grouper.add(createdAt: 30, fingerprint: .dhash(0))
    XCTAssertEqual(grouper.groups(), [[0, 1]])
  }

  func testJoinsTheClosestSeries() {
    var grouper = SimilarityGrouper(windowMs: 600_000, thresholds: thresholds)
    grouper.add(createdAt: 0, fingerprint: .vision([0, 0]))
    grouper.add(createdAt: 1, fingerprint: .vision([1, 0]))
    grouper.add(createdAt: 2, fingerprint: .vision([0.9, 0]))
    grouper.add(createdAt: 3, fingerprint: .vision([0.1, 0]))
    XCTAssertEqual(grouper.groups(), [[0, 3], [1, 2]])
  }

  func testLevelsAreOrderedBySensitivity() {
    let low = SimilarityThresholds.forLevel(.low)
    let medium = SimilarityThresholds.forLevel(.medium)
    let high = SimilarityThresholds.forLevel(.high)
    XCTAssertLessThan(low.vision, medium.vision)
    XCTAssertLessThan(medium.vision, high.vision)
    XCTAssertLessThan(low.dhash, medium.dhash)
    XCTAssertLessThan(medium.dhash, high.dhash)
  }

  func testFingerprintDecoding() {
    XCTAssertEqual(Fingerprint(kind: "dhash-v1", encoded: ImageMetrics.encodeHash(42))?.kind, .dhash)
    XCTAssertEqual(Fingerprint(kind: "vision-v1", encoded: FeatureVector.encode([1, 2]))?.kind, .vision)
    XCTAssertNil(Fingerprint(kind: "unknown", encoded: ""))
  }
}

final class DuplicateGrouperTests: XCTestCase {
  func testToleranceAcceptsSmallNoiseAndRejectsEdits() {
    let base = ImageMetrics.signature(TestImages.gradientNoise(size: 96, seed: 5))
    let noisy = base.enumerated().map { UInt8(clamping: Int($0.element) + ($0.offset % 3 == 0 ? 2 : -1)) }
    let brighter = base.map { UInt8(clamping: Int($0) + 20) }
    XCTAssertTrue(DuplicateTolerance.standard.matches(base, noisy))
    XCTAssertFalse(DuplicateTolerance.standard.matches(base, brighter))
  }

  func testGroupsOnlySameDimensions() {
    let base = ImageMetrics.signature(TestImages.gradientNoise(size: 96, seed: 5))
    let other = ImageMetrics.signature(TestImages.gradientNoise(size: 96, seed: 9))
    var grouper = DuplicateGrouper()
    grouper.add(width: 4032, height: 3024, signature: base, sharpness: 300)
    grouper.add(width: 4032, height: 3024, signature: other, sharpness: 300)
    grouper.add(width: 4032, height: 3024, signature: base, sharpness: 320)
    grouper.add(width: 3024, height: 4032, signature: base, sharpness: 300)
    grouper.add(width: 4032, height: 3024, signature: base, sharpness: 20)
    XCTAssertEqual(grouper.groups(), [[0, 2]])
  }
}

enum TestImages {
  static func checkerboard(size: Int, cell: Int) -> GrayImage {
    var pixels = [UInt8](repeating: 0, count: size * size)
    for y in 0..<size {
      for x in 0..<size where ((x / cell) + (y / cell)) % 2 == 0 {
        pixels[y * size + x] = 255
      }
    }
    return GrayImage(width: size, height: size, pixels: pixels)!
  }

  static func gradientNoise(size: Int, seed: UInt64) -> GrayImage {
    var state = seed &* 6_364_136_223_846_793_005 &+ 1
    var pixels = [UInt8](repeating: 0, count: size * size)
    let blobs = (0..<6).map { _ -> (Double, Double, Double) in
      state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      let x = Double(state >> 40 & 0xff) / 255 * Double(size)
      state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      let y = Double(state >> 40 & 0xff) / 255 * Double(size)
      state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      let intensity = Double(state >> 40 & 0xff)
      return (x, y, intensity)
    }
    for y in 0..<size {
      for x in 0..<size {
        var value = 0.0
        for blob in blobs {
          let dx = Double(x) - blob.0
          let dy = Double(y) - blob.1
          value += blob.2 * exp(-(dx * dx + dy * dy) / Double(size * size / 8))
        }
        pixels[y * size + x] = UInt8(min(value, 255))
      }
    }
    return GrayImage(width: size, height: size, pixels: pixels)!
  }

  static func map(_ image: GrayImage, _ transform: (UInt8) -> Int) -> GrayImage {
    GrayImage(width: image.width, height: image.height, pixels: image.pixels.map { UInt8(clamping: transform($0)) })!
  }

  static func boxBlur(_ image: GrayImage, radius: Int) -> GrayImage {
    var pixels = image.pixels
    for y in 0..<image.height {
      for x in 0..<image.width {
        var sum = 0
        var count = 0
        for dy in -radius...radius {
          for dx in -radius...radius {
            let sx = x + dx
            let sy = y + dy
            if sx >= 0, sy >= 0, sx < image.width, sy < image.height {
              sum += Int(image[sx, sy])
              count += 1
            }
          }
        }
        pixels[y * image.width + x] = UInt8(sum / count)
      }
    }
    return GrayImage(width: image.width, height: image.height, pixels: pixels)!
  }
}
