import Accelerate
import Foundation

public enum FeatureVector {
  public static func encode(_ values: [Float]) -> String {
    guard !values.isEmpty else {
      return ""
    }
    var halves = [UInt16](repeating: 0, count: values.count)
    var source = values
    source.withUnsafeMutableBytes { sourceBytes in
      halves.withUnsafeMutableBytes { destinationBytes in
        var sourceBuffer = vImage_Buffer(
          data: sourceBytes.baseAddress,
          height: 1,
          width: vImagePixelCount(values.count),
          rowBytes: values.count * MemoryLayout<Float>.size
        )
        var destinationBuffer = vImage_Buffer(
          data: destinationBytes.baseAddress,
          height: 1,
          width: vImagePixelCount(values.count),
          rowBytes: values.count * MemoryLayout<UInt16>.size
        )
        vImageConvert_PlanarFtoPlanar16F(&sourceBuffer, &destinationBuffer, 0)
      }
    }
    let littleEndian = halves.map { $0.littleEndian }
    return littleEndian.withUnsafeBytes { Data($0) }.base64EncodedString()
  }

  public static func decode(_ base64: String) -> [Float]? {
    guard let data = Data(base64Encoded: base64), !data.isEmpty, data.count % 2 == 0 else {
      return nil
    }
    let count = data.count / 2
    var halves = [UInt16](repeating: 0, count: count)
    _ = halves.withUnsafeMutableBytes { data.copyBytes(to: $0) }
    halves = halves.map { UInt16(littleEndian: $0) }
    var floats = [Float](repeating: 0, count: count)
    halves.withUnsafeMutableBytes { sourceBytes in
      floats.withUnsafeMutableBytes { destinationBytes in
        var sourceBuffer = vImage_Buffer(
          data: sourceBytes.baseAddress,
          height: 1,
          width: vImagePixelCount(count),
          rowBytes: count * MemoryLayout<UInt16>.size
        )
        var destinationBuffer = vImage_Buffer(
          data: destinationBytes.baseAddress,
          height: 1,
          width: vImagePixelCount(count),
          rowBytes: count * MemoryLayout<Float>.size
        )
        vImageConvert_Planar16FtoPlanarF(&sourceBuffer, &destinationBuffer, 0)
      }
    }
    return floats
  }

  public static func isInformative(_ values: [Float]) -> Bool {
    guard values.count > 1, values.allSatisfy(\.isFinite) else { return false }
    let mean = vDSP.mean(values)
    let variance = vDSP.meanSquare(values) - mean * mean
    return variance > 1e-8
  }

  public static func distance(_ a: [Float], _ b: [Float]) -> Float {
    guard a.count == b.count, !a.isEmpty else {
      return .infinity
    }
    return vDSP.distanceSquared(a, b).squareRoot()
  }
}
