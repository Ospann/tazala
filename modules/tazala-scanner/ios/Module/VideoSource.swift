import AVFoundation
import Photos

enum VideoSourceStatus: String {
  case ok
  case cloudOnly = "cloud-only"
  case unavailable
  case cancelled
}

enum VideoSourceReason: String {
  case notUrlAsset = "not-url-asset"
  case nilAsset = "nil-asset"
  case missingAsset = "missing-asset"
  case exportFailed = "export-failed"
}

struct VideoSourceResult {
  let uri: URL?
  let status: VideoSourceStatus
  var reason: VideoSourceReason? = nil

  var dictionary: [String: Any?] {
    ["uri": uri?.absoluteString, "status": status.rawValue, "reason": reason?.rawValue]
  }
}

enum VideoSource {
  static func resolve(identifier: String) async -> VideoSourceResult {
    if let cached = assets.url(for: identifier) {
      return VideoSourceResult(uri: cached, status: .ok)
    }
    guard let asset = fetchVideo(identifier) else {
      return VideoSourceResult(uri: nil, status: .unavailable, reason: .missingAsset)
    }
    let current = await request(asset, version: .current)
    if let urlAsset = current.urlAsset {
      assets.store(urlAsset, for: identifier)
      return VideoSourceResult(uri: urlAsset.url, status: .ok)
    }
    let original = await request(asset, version: .original)
    if let urlAsset = original.urlAsset {
      assets.store(urlAsset, for: identifier)
      return VideoSourceResult(uri: urlAsset.url, status: .ok)
    }
    if current.inCloud || original.inCloud {
      return VideoSourceResult(uri: nil, status: .cloudOnly)
    }
    let reason: VideoSourceReason = current.hadAsset || original.hadAsset ? .notUrlAsset : .nilAsset
    return VideoSourceResult(uri: nil, status: .unavailable, reason: reason)
  }

  static func download(
    identifier: String,
    progress: @escaping (Double) -> Void
  ) async -> VideoSourceResult {
    guard let asset = fetchVideo(identifier) else {
      return VideoSourceResult(uri: nil, status: .unavailable, reason: .missingAsset)
    }
    var hadAsset = false
    for version in [PHVideoRequestOptionsVersion.current, .original] {
      let result = await request(
        asset,
        version: version,
        networkAllowed: true,
        identifier: identifier,
        progress: progress
      )
      if result.cancelled {
        return VideoSourceResult(uri: nil, status: .cancelled)
      }
      if let urlAsset = result.urlAsset {
        assets.store(urlAsset, for: identifier)
        return VideoSourceResult(uri: urlAsset.url, status: .ok)
      }
      hadAsset = hadAsset || result.hadAsset
    }
    return VideoSourceResult(uri: nil, status: .unavailable, reason: hadAsset ? .notUrlAsset : .nilAsset)
  }

  static func export(identifier: String) async -> VideoSourceResult {
    guard let asset = fetchVideo(identifier) else {
      return VideoSourceResult(uri: nil, status: .unavailable, reason: .missingAsset)
    }
    var source: AVAsset?
    for version in [PHVideoRequestOptionsVersion.current, .original] {
      let result = await request(asset, version: version)
      if let avAsset = result.avAsset {
        source = avAsset
        break
      }
      if result.inCloud {
        return VideoSourceResult(uri: nil, status: .cloudOnly)
      }
    }
    guard let source,
      let session = AVAssetExportSession(asset: source, presetName: AVAssetExportPresetPassthrough)
    else {
      return VideoSourceResult(uri: nil, status: .unavailable, reason: .exportFailed)
    }
    let fileType: AVFileType = session.supportedFileTypes.contains(.mov) ? .mov : .mp4
    let target = exportURL(for: identifier, fileType: fileType)
    try? FileManager.default.removeItem(at: target)
    guard await run(session, to: target, as: fileType) else {
      try? FileManager.default.removeItem(at: target)
      return VideoSourceResult(uri: nil, status: .unavailable, reason: .exportFailed)
    }
    return VideoSourceResult(uri: target, status: .ok)
  }

  private static func run(_ session: AVAssetExportSession, to target: URL, as fileType: AVFileType) async -> Bool {
    if #available(iOS 18.0, *) {
      do {
        try await session.export(to: target, as: fileType)
        return true
      } catch {
        return false
      }
    }
    return await legacyExport(session, to: target, as: fileType)
  }

  @available(iOS, deprecated: 18.0)
  private static func legacyExport(_ session: AVAssetExportSession, to target: URL, as fileType: AVFileType) async -> Bool {
    session.outputURL = target
    session.outputFileType = fileType
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      session.exportAsynchronously { continuation.resume() }
    }
    return session.status == .completed
  }

  static func release(identifier: String) {
    assets.remove(identifier)
    let directory = exportDirectory
    let prefix = sanitized(identifier) + "."
    let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
    for file in files where file.hasPrefix(prefix) {
      try? FileManager.default.removeItem(at: directory.appendingPathComponent(file))
    }
  }

  static func clearExports() {
    try? FileManager.default.removeItem(at: exportDirectory)
  }

  static func cancelDownload(identifier: String) {
    downloads.cancel(identifier: identifier)
  }

  private static let downloads = DownloadRegistry()
  private static let assets = ResolvedAssetCache(capacity: 6)

  private static var exportDirectory: URL {
    FileManager.default.temporaryDirectory.appendingPathComponent("tazala-video", isDirectory: true)
  }

  private static func sanitized(_ identifier: String) -> String {
    String(identifier.map { $0.isLetter || $0.isNumber || $0 == "-" ? $0 : "_" })
  }

  private static func exportURL(for identifier: String, fileType: AVFileType) -> URL {
    let directory = exportDirectory
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let ext = fileType == .mov ? "mov" : "mp4"
    return directory.appendingPathComponent("\(sanitized(identifier)).\(ext)")
  }

  private static func fetchVideo(_ identifier: String) -> PHAsset? {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
    guard let asset = fetch.firstObject, asset.mediaType == .video else { return nil }
    return asset
  }

  private struct RequestResult {
    let avAsset: AVAsset?
    let inCloud: Bool
    let cancelled: Bool

    var urlAsset: AVURLAsset? { avAsset as? AVURLAsset }
    var hadAsset: Bool { avAsset != nil }
  }

  private static func request(
    _ asset: PHAsset,
    version: PHVideoRequestOptionsVersion,
    networkAllowed: Bool = false,
    identifier: String? = nil,
    progress: ((Double) -> Void)? = nil
  ) async -> RequestResult {
    let options = PHVideoRequestOptions()
    options.isNetworkAccessAllowed = networkAllowed
    options.deliveryMode = .automatic
    options.version = version
    if let progress {
      options.progressHandler = { value, _, _, _ in progress(value) }
    }
    return await withCheckedContinuation { continuation in
      let requestId = PHImageManager.default().requestAVAsset(forVideo: asset, options: options) {
        avAsset, _, info in
        if let identifier {
          downloads.finish(identifier: identifier)
        }
        let inCloud = (info?[PHImageResultIsInCloudKey] as? NSNumber)?.boolValue ?? false
        let cancelled = (info?[PHImageCancelledKey] as? NSNumber)?.boolValue ?? false
        continuation.resume(returning: RequestResult(avAsset: avAsset, inCloud: inCloud, cancelled: cancelled))
      }
      if let identifier {
        downloads.start(identifier: identifier, requestId: requestId)
      }
    }
  }
}

private final class ResolvedAssetCache: @unchecked Sendable {
  private let lock = NSLock()
  private let capacity: Int
  private var assets: [String: AVURLAsset] = [:]
  private var order: [String] = []

  init(capacity: Int) {
    self.capacity = capacity
  }

  func url(for identifier: String) -> URL? {
    lock.lock()
    defer { lock.unlock() }
    guard let asset = assets[identifier] else { return nil }
    order.removeAll { $0 == identifier }
    order.append(identifier)
    return asset.url
  }

  func store(_ asset: AVURLAsset, for identifier: String) {
    lock.lock()
    defer { lock.unlock() }
    assets[identifier] = asset
    order.removeAll { $0 == identifier }
    order.append(identifier)
    while order.count > capacity {
      assets.removeValue(forKey: order.removeFirst())
    }
  }

  func remove(_ identifier: String) {
    lock.lock()
    defer { lock.unlock() }
    assets.removeValue(forKey: identifier)
    order.removeAll { $0 == identifier }
  }
}

private final class DownloadRegistry: @unchecked Sendable {
  private let lock = NSLock()
  private var requests: [String: PHImageRequestID] = [:]

  func start(identifier: String, requestId: PHImageRequestID) {
    lock.lock()
    requests[identifier] = requestId
    lock.unlock()
  }

  func finish(identifier: String) {
    lock.lock()
    requests.removeValue(forKey: identifier)
    lock.unlock()
  }

  func cancel(identifier: String) {
    lock.lock()
    let requestId = requests.removeValue(forKey: identifier)
    lock.unlock()
    if let requestId {
      PHImageManager.default().cancelImageRequest(requestId)
    }
  }
}
