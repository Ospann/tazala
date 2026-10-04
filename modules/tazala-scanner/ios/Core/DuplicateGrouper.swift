import Foundation

public struct DuplicateTolerance: Sendable {
  public let maxPixelDifference: Int
  public let maxMeanDifference: Double
  public let maxSharpnessRatio: Double

  public init(maxPixelDifference: Int, maxMeanDifference: Double, maxSharpnessRatio: Double) {
    self.maxPixelDifference = maxPixelDifference
    self.maxMeanDifference = maxMeanDifference
    self.maxSharpnessRatio = maxSharpnessRatio
  }

  public static let standard = DuplicateTolerance(maxPixelDifference: 8, maxMeanDifference: 2.5, maxSharpnessRatio: 1.6)

  public func similarSharpness(_ a: Double, _ b: Double) -> Bool {
    let low = max(min(a, b), 0.001)
    let high = max(max(a, b), 0.001)
    return high / low <= maxSharpnessRatio
  }

  public func matches(_ a: [UInt8], _ b: [UInt8]) -> Bool {
    guard a.count == b.count, !a.isEmpty else { return false }
    var total = 0
    for index in 0..<a.count {
      let difference = abs(Int(a[index]) - Int(b[index]))
      if difference > maxPixelDifference { return false }
      total += difference
    }
    return Double(total) / Double(a.count) <= maxMeanDifference
  }
}

public struct DuplicateGrouper {
  private struct Entry {
    let index: Int
    let mean: Double
    let signature: [UInt8]
    let sharpness: Double
  }

  private struct SizeKey: Hashable {
    let width: Int
    let height: Int
  }

  private let tolerance: DuplicateTolerance
  private var buckets: [SizeKey: [Entry]] = [:]
  private var count = 0

  public private(set) var comparisons = 0

  public init(tolerance: DuplicateTolerance = .standard) {
    self.tolerance = tolerance
  }

  @discardableResult
  public mutating func add(width: Int, height: Int, signature: [UInt8], sharpness: Double) -> Int {
    let index = count
    count += 1
    let mean = signature.isEmpty ? 0 : Double(signature.reduce(0) { $0 + Int($1) }) / Double(signature.count)
    buckets[SizeKey(width: width, height: height), default: []].append(Entry(index: index, mean: mean, signature: signature, sharpness: sharpness))
    return index
  }

  public mutating func groups() -> [[Int]] {
    var parent = Array(0..<count)
    func find(_ index: Int) -> Int {
      var root = index
      while parent[root] != root { root = parent[root] }
      var current = index
      while parent[current] != root {
        let next = parent[current]
        parent[current] = root
        current = next
      }
      return root
    }

    for entries in buckets.values where entries.count > 1 {
      let sorted = entries.sorted { $0.mean < $1.mean }
      for position in 0..<sorted.count {
        let current = sorted[position]
        var next = position + 1
        while next < sorted.count, sorted[next].mean - current.mean <= tolerance.maxMeanDifference {
          comparisons += 1
          if tolerance.similarSharpness(current.sharpness, sorted[next].sharpness),
            tolerance.matches(current.signature, sorted[next].signature)
          {
            let rootA = find(current.index)
            let rootB = find(sorted[next].index)
            if rootA != rootB { parent[max(rootA, rootB)] = min(rootA, rootB) }
          }
          next += 1
        }
      }
    }

    var grouped: [Int: [Int]] = [:]
    for index in 0..<count {
      grouped[find(index), default: []].append(index)
    }
    return grouped.values.filter { $0.count > 1 }.sorted { $0[0] < $1[0] }
  }
}
