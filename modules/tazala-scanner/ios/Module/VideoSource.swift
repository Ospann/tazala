import AVFoundation
import Photos

enum VideoSourceStatus: String {
  case ok
  case cloudOnly = "cloud-only"
  case unavailable
  case cancelled
}

struct VideoSourceResult {
  let uri: URL?
  let status: VideoSourceStatus

  var dictionary: [String: Any?] {
    ["uri": uri?.absoluteString, "status": status.rawValue]
  }
}

enum VideoSource {
  static func resolve(identifier: String) async -> VideoSourceResult {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
    guard let asset = fetch.firstObject, asset.mediaType == .video else {
      return VideoSourceResult(uri: nil, status: .unavailable)
    }
    let current = await request(asset, version: .current)
    if let url = current.url {
      return VideoSourceResult(uri: url, status: .ok)
    }
    let original = await request(asset, version: .original)
    if let url = original.url {
      return VideoSourceResult(uri: url, status: .ok)
    }
    let inCloud = current.inCloud || original.inCloud
    return VideoSourceResult(uri: nil, status: inCloud ? .cloudOnly : .unavailable)
  }

  static func download(
    identifier: String,
    progress: @escaping (Double) -> Void
  ) async -> VideoSourceResult {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
    guard let asset = fetch.firstObject, asset.mediaType == .video else {
      return VideoSourceResult(uri: nil, status: .unavailable)
    }
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
      if let url = result.url {
        return VideoSourceResult(uri: url, status: .ok)
      }
    }
    return VideoSourceResult(uri: nil, status: .unavailable)
  }

  static func cancelDownload(identifier: String) {
    downloads.cancel(identifier: identifier)
  }

  private static let downloads = DownloadRegistry()

  private static func request(
    _ asset: PHAsset,
    version: PHVideoRequestOptionsVersion,
    networkAllowed: Bool = false,
    identifier: String? = nil,
    progress: ((Double) -> Void)? = nil
  ) async -> (url: URL?, inCloud: Bool, cancelled: Bool) {
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
        continuation.resume(returning: ((avAsset as? AVURLAsset)?.url, inCloud, cancelled))
      }
      if let identifier {
        downloads.start(identifier: identifier, requestId: requestId)
      }
    }
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
