import Foundation
import Photos

struct DeletionResult {
  let deletedIds: [String]
  let failedIds: [String]
  let missingIds: [String]
  let cancelled: Bool

  var dictionary: [String: Any] {
    [
      "deletedIds": deletedIds,
      "failedIds": failedIds,
      "missingIds": missingIds,
      "cancelled": cancelled,
    ]
  }
}

enum AssetDeleter {
  static func delete(identifiers: [String], library: PhotoLibrary) async -> DeletionResult {
    let unique = Array(NSOrderedSet(array: identifiers)) as? [String] ?? identifiers
    guard !unique.isEmpty else {
      return DeletionResult(deletedIds: [], failedIds: [], missingIds: [], cancelled: false)
    }
    let existingBefore = library.existingIdentifiers(unique)
    let missing = unique.filter { !existingBefore.contains($0) }
    let targets = unique.filter { existingBefore.contains($0) }
    guard !targets.isEmpty else {
      return DeletionResult(deletedIds: [], failedIds: [], missingIds: missing, cancelled: false)
    }

    let assets = PHAsset.fetchAssets(withLocalIdentifiers: targets, options: nil)
    var cancelled = false
    do {
      try await PHPhotoLibrary.shared().performChanges {
        PHAssetChangeRequest.deleteAssets(assets)
      }
    } catch {
      let nsError = error as NSError
      cancelled = nsError.domain == PHPhotosErrorDomain
        && nsError.code == PHPhotosError.Code.userCancelled.rawValue
    }

    let existingAfter = library.existingIdentifiers(targets)
    let deleted = targets.filter { !existingAfter.contains($0) }
    let failed = targets.filter { existingAfter.contains($0) }
    return DeletionResult(deletedIds: deleted, failedIds: failed, missingIds: missing, cancelled: cancelled && deleted.isEmpty)
  }
}
