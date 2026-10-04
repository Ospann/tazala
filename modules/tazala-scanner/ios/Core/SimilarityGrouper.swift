import Foundation

public enum SimilarityLevel: String, Sendable {
  case low
  case medium
  case high
}

public enum FingerprintKind: String, Sendable {
  case vision = "vision-v1"
  case dhash = "dhash-v1"
}

public enum Fingerprint: Sendable {
  case vision([Float])
  case dhash(UInt64)

  public var kind: FingerprintKind {
    switch self {
    case .vision: return .vision
    case .dhash: return .dhash
    }
  }

  public init?(kind: String, encoded: String) {
    switch FingerprintKind(rawValue: kind) {
    case .vision:
      guard let vector = FeatureVector.decode(encoded) else { return nil }
      self = .vision(vector)
    case .dhash:
      guard let hash = ImageMetrics.decodeHash(encoded) else { return nil }
      self = .dhash(hash)
    case nil:
      return nil
    }
  }
}

public struct SimilarityThresholds: Sendable {
  public let vision: Float
  public let dhash: Int

  public init(vision: Float, dhash: Int) {
    self.vision = vision
    self.dhash = dhash
  }

  public static func forLevel(_ level: SimilarityLevel) -> SimilarityThresholds {
    switch level {
    case .low: return SimilarityThresholds(vision: 0.4, dhash: 6)
    case .medium: return SimilarityThresholds(vision: 0.55, dhash: 10)
    case .high: return SimilarityThresholds(vision: 0.65, dhash: 14)
    }
  }

  public func distance(_ a: Fingerprint, _ b: Fingerprint) -> Double? {
    switch (a, b) {
    case let (.vision(left), .vision(right)):
      let value = FeatureVector.distance(left, right)
      return value <= vision ? Double(value) : nil
    case let (.dhash(left), .dhash(right)):
      let value = ImageMetrics.hammingDistance(left, right)
      return value <= dhash ? Double(value) : nil
    default:
      return nil
    }
  }

  public func isSimilar(_ a: Fingerprint, _ b: Fingerprint) -> Bool {
    distance(a, b) != nil
  }
}

public struct SimilarityGrouper {
  private struct Cluster {
    var members: [(index: Int, fingerprint: Fingerprint)]
    var lastCreatedAt: Int64
    let kind: FingerprintKind
  }

  private let windowMs: Int64
  private let thresholds: SimilarityThresholds
  private var clusters: [Cluster] = []
  private var active: [Int] = []
  private var count = 0
  private var lastCreatedAt = Int64.min

  public private(set) var comparisons = 0

  public init(windowMs: Int64, thresholds: SimilarityThresholds) {
    self.windowMs = windowMs
    self.thresholds = thresholds
  }

  @discardableResult
  public mutating func add(createdAt: Int64, fingerprint: Fingerprint) -> Int {
    let index = count
    count += 1
    let timestamp = max(createdAt, lastCreatedAt)
    lastCreatedAt = timestamp
    let cutoff = timestamp - windowMs
    active.removeAll { clusters[$0].lastCreatedAt < cutoff }

    var best: (cluster: Int, worst: Double)?
    for clusterIndex in active where clusters[clusterIndex].kind == fingerprint.kind {
      var worst = 0.0
      var matches = true
      for member in clusters[clusterIndex].members {
        comparisons += 1
        guard let distance = thresholds.distance(member.fingerprint, fingerprint) else {
          matches = false
          break
        }
        worst = max(worst, distance)
      }
      if matches, best == nil || worst < best!.worst {
        best = (clusterIndex, worst)
      }
    }

    if let best {
      clusters[best.cluster].members.append((index, fingerprint))
      clusters[best.cluster].lastCreatedAt = timestamp
    } else {
      clusters.append(Cluster(members: [(index, fingerprint)], lastCreatedAt: timestamp, kind: fingerprint.kind))
      active.append(clusters.count - 1)
    }
    return index
  }

  public func groups() -> [[Int]] {
    clusters
      .filter { $0.members.count > 1 }
      .map { $0.members.map(\.index) }
      .sorted { $0[0] < $1[0] }
  }
}
