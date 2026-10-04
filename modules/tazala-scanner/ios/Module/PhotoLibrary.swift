import Foundation
import Photos

enum PermissionStatus: String {
  case granted
  case limited
  case denied
  case undetermined

  init(_ status: PHAuthorizationStatus) {
    switch status {
    case .authorized: self = .granted
    case .limited: self = .limited
    case .denied, .restricted: self = .denied
    case .notDetermined: self = .undetermined
    @unknown default: self = .denied
    }
  }
}

final class PhotoLibrary {
  private let lock = NSLock()
  private var cachedFetch: PHFetchResult<PHAsset>?

  func permissionStatus() -> PermissionStatus {
    PermissionStatus(PHPhotoLibrary.authorizationStatus(for: .readWrite))
  }

  func requestPermission() async -> PermissionStatus {
    let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
    return PermissionStatus(status)
  }

  var hasAccess: Bool {
    let status = permissionStatus()
    return status == .granted || status == .limited
  }

  func stats() -> [String: Any] {
    let options = PHFetchOptions()
    options.includeHiddenAssets = false
    return [
      "photoCount": PHAsset.fetchAssets(with: .image, options: options).count,
      "videoCount": PHAsset.fetchAssets(with: .video, options: options).count,
    ]
  }

  func listAssets(offset: Int, limit: Int) -> [[String: Any]] {
    let fetch = assetsFetch(refresh: offset == 0)
    let start = max(offset, 0)
    let end = min(start + max(limit, 0), fetch.count)
    guard start < end else {
      return []
    }
    var result: [[String: Any]] = []
    result.reserveCapacity(end - start)
    fetch.enumerateObjects(at: IndexSet(integersIn: start..<end), options: []) { asset, _, _ in
      autoreleasepool {
        result.append(Self.describe(asset))
      }
    }
    return result
  }

  func photoAssets(withIdentifiers identifiers: [String]?) -> [PHAsset] {
    let options = PHFetchOptions()
    options.includeHiddenAssets = false
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
    options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
    let fetch: PHFetchResult<PHAsset>
    if let identifiers {
      fetch = PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: options)
    } else {
      fetch = PHAsset.fetchAssets(with: options)
    }
    var assets: [PHAsset] = []
    assets.reserveCapacity(fetch.count)
    fetch.enumerateObjects { asset, _, _ in assets.append(asset) }
    return assets
  }

  func existingIdentifiers(_ identifiers: [String]) -> Set<String> {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: nil)
    var existing = Set<String>()
    fetch.enumerateObjects { asset, _, _ in existing.insert(asset.localIdentifier) }
    return existing
  }

  private func assetsFetch(refresh: Bool) -> PHFetchResult<PHAsset> {
    lock.lock()
    defer { lock.unlock() }
    if !refresh, let cachedFetch {
      return cachedFetch
    }
    let options = PHFetchOptions()
    options.includeHiddenAssets = false
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
    options.predicate = NSPredicate(
      format: "mediaType == %d OR mediaType == %d",
      PHAssetMediaType.image.rawValue,
      PHAssetMediaType.video.rawValue
    )
    let fetch = PHAsset.fetchAssets(with: options)
    cachedFetch = fetch
    return fetch
  }

  private static func describe(_ asset: PHAsset) -> [String: Any] {
    let isVideo = asset.mediaType == .video
    let size = fileSize(of: asset)
    var info: [String: Any] = [
      "id": asset.localIdentifier,
      "uri": "ph://\(asset.localIdentifier)",
      "mediaType": isVideo ? "video" : "photo",
      "createdAt": milliseconds(asset.creationDate),
      "modifiedAt": milliseconds(asset.modificationDate ?? asset.creationDate),
      "width": asset.pixelWidth,
      "height": asset.pixelHeight,
      "fileSize": size.bytes,
      "fileSizeEstimated": size.estimated,
      "isScreenshot": asset.mediaSubtypes.contains(.photoScreenshot),
      "isFavorite": asset.isFavorite,
    ]
    if isVideo {
      info["duration"] = asset.duration
    }
    return info
  }

  private static func fileSize(of asset: PHAsset) -> (bytes: Double, estimated: Bool) {
    let resources = PHAssetResource.assetResources(for: asset)
    var total: Int64 = 0
    for resource in resources {
      if let size = resource.value(forKey: "fileSize") as? NSNumber {
        total += size.int64Value
      }
    }
    if total > 0 {
      return (Double(total), false)
    }
    if asset.mediaType == .video {
      return (max(asset.duration, 1) * 1_500_000, true)
    }
    return (Double(asset.pixelWidth * asset.pixelHeight) * 0.3, true)
  }

  private static func milliseconds(_ date: Date?) -> Double {
    guard let date else { return 0 }
    return (date.timeIntervalSince1970 * 1000).rounded()
  }
}
