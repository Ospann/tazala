import Foundation

public struct GrayImage: Equatable, Sendable {
  public let width: Int
  public let height: Int
  public let pixels: [UInt8]

  public init?(width: Int, height: Int, pixels: [UInt8]) {
    guard width > 0, height > 0, pixels.count == width * height else {
      return nil
    }
    self.width = width
    self.height = height
    self.pixels = pixels
  }

  public subscript(x: Int, y: Int) -> UInt8 {
    pixels[y * width + x]
  }

  public func resized(width newWidth: Int, height newHeight: Int) -> GrayImage {
    precondition(newWidth > 0 && newHeight > 0)
    var output = [UInt8](repeating: 0, count: newWidth * newHeight)
    for y in 0..<newHeight {
      let sy0 = y * height / newHeight
      let sy1 = max(sy0 + 1, (y + 1) * height / newHeight)
      for x in 0..<newWidth {
        let sx0 = x * width / newWidth
        let sx1 = max(sx0 + 1, (x + 1) * width / newWidth)
        var sum = 0
        for sy in sy0..<sy1 {
          let row = sy * width
          for sx in sx0..<sx1 {
            sum += Int(pixels[row + sx])
          }
        }
        let count = (sy1 - sy0) * (sx1 - sx0)
        output[y * newWidth + x] = UInt8((sum + count / 2) / count)
      }
    }
    return GrayImage(width: newWidth, height: newHeight, pixels: output)!
  }

  public static func fittingSize(width: Int, height: Int, maxSide: Int) -> (width: Int, height: Int) {
    let longest = max(width, height)
    guard longest > maxSide else {
      return (max(width, 1), max(height, 1))
    }
    let scale = Double(maxSide) / Double(longest)
    return (
      max(Int((Double(width) * scale).rounded()), 1),
      max(Int((Double(height) * scale).rounded()), 1)
    )
  }
}
