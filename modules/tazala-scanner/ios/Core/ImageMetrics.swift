import Foundation

public enum ImageMetrics {
  public static let analysisMaxSide = 256

  public static func laplacianVariance(_ image: GrayImage) -> Double {
    let width = image.width
    let height = image.height
    guard width >= 3, height >= 3 else {
      return 0
    }
    let pixels = image.pixels
    var sum = 0.0
    var sumOfSquares = 0.0
    for y in 1..<(height - 1) {
      let row = y * width
      for x in 1..<(width - 1) {
        let center = Int(pixels[row + x])
        let value = Int(pixels[row - width + x]) + Int(pixels[row + width + x])
          + Int(pixels[row + x - 1]) + Int(pixels[row + x + 1]) - 4 * center
        let v = Double(value)
        sum += v
        sumOfSquares += v * v
      }
    }
    let count = Double((width - 2) * (height - 2))
    let mean = sum / count
    return max(sumOfSquares / count - mean * mean, 0)
  }

  public static func dHash(_ image: GrayImage) -> UInt64 {
    let small = image.resized(width: 9, height: 8)
    var hash: UInt64 = 0
    for y in 0..<8 {
      for x in 0..<8 {
        hash <<= 1
        if small[x, y] > small[x + 1, y] {
          hash |= 1
        }
      }
    }
    return hash
  }

  public static let signatureSide = 16

  public static func signature(_ image: GrayImage) -> [UInt8] {
    image.resized(width: signatureSide, height: signatureSide).pixels
  }

  public static func encodeSignature(_ signature: [UInt8]) -> String {
    Data(signature).base64EncodedString()
  }

  public static func decodeSignature(_ base64: String) -> [UInt8]? {
    guard let data = Data(base64Encoded: base64), data.count == signatureSide * signatureSide else {
      return nil
    }
    return [UInt8](data)
  }

  public static func hammingDistance(_ a: UInt64, _ b: UInt64) -> Int {
    (a ^ b).nonzeroBitCount
  }

  public static func encodeHash(_ hash: UInt64) -> String {
    var bigEndian = hash.bigEndian
    return withUnsafeBytes(of: &bigEndian) { Data($0) }.base64EncodedString()
  }

  public static func decodeHash(_ base64: String) -> UInt64? {
    guard let data = Data(base64Encoded: base64), data.count == 8 else {
      return nil
    }
    return data.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
  }
}
