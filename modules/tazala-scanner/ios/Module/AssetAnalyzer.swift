import CoreGraphics
import Foundation
import Photos
import UIKit
import Vision

enum AnalysisStatus: String {
  case ok
  case cloudOnly = "cloud-only"
  case failed
}

struct AssetAnalysisResult {
  let id: String
  let status: AnalysisStatus
  let fingerprint: Fingerprint?
  let blurScore: Double
  let exactHash: String

  var dictionary: [String: Any] {
    var result: [String: Any] = [
      "id": id,
      "status": status.rawValue,
      "blurScore": blurScore,
      "exactHash": exactHash,
      "analysisVersion": AssetAnalyzer.analysisVersion,
    ]
    switch fingerprint {
    case let .vision(vector):
      result["fingerprint"] = FeatureVector.encode(vector)
      result["fingerprintKind"] = FingerprintKind.vision.rawValue
    case let .dhash(hash):
      result["fingerprint"] = ImageMetrics.encodeHash(hash)
      result["fingerprintKind"] = FingerprintKind.dhash.rawValue
    case nil:
      result["fingerprint"] = NSNull()
      result["fingerprintKind"] = NSNull()
    }
    return result
  }
}

final class AssetAnalyzer {
  static var analysisVersion: Int { supportsVisionFingerprint ? 2 : 1 }
  static let thumbnailSide: CGFloat = 300

  private let imageManager = PHImageManager.default()
  private let useVision: Bool

  init(useVision: Bool = AssetAnalyzer.supportsVisionFingerprint) {
    self.useVision = useVision
  }

  func analyze(_ asset: PHAsset) -> AssetAnalysisResult {
    let thumbnail = loadThumbnail(asset)
    guard let cgImage = thumbnail.image else {
      return AssetAnalysisResult(
        id: asset.localIdentifier,
        status: thumbnail.inCloud ? .cloudOnly : .failed,
        fingerprint: nil,
        blurScore: 0,
        exactHash: ""
      )
    }
    guard let gray = Self.grayImage(from: cgImage) else {
      return AssetAnalysisResult(
        id: asset.localIdentifier,
        status: .failed,
        fingerprint: nil,
        blurScore: 0,
        exactHash: ""
      )
    }
    let fingerprint: Fingerprint
    if useVision, let vector = Self.featurePrint(cgImage) {
      fingerprint = .vision(vector)
    } else {
      fingerprint = .dhash(ImageMetrics.dHash(gray))
    }
    return AssetAnalysisResult(
      id: asset.localIdentifier,
      status: .ok,
      fingerprint: fingerprint,
      blurScore: ImageMetrics.laplacianVariance(gray),
      exactHash: ImageMetrics.encodeSignature(ImageMetrics.signature(gray))
    )
  }

  private func loadThumbnail(_ asset: PHAsset) -> (image: CGImage?, inCloud: Bool) {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.isNetworkAccessAllowed = false
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.version = .current

    var image: CGImage?
    var inCloud = false
    imageManager.requestImage(
      for: asset,
      targetSize: CGSize(width: Self.thumbnailSide, height: Self.thumbnailSide),
      contentMode: .aspectFit,
      options: options
    ) { result, info in
      image = result?.cgImage
      inCloud = (info?[PHImageResultIsInCloudKey] as? NSNumber)?.boolValue ?? false
    }
    return (image, inCloud)
  }

  static func grayImage(from cgImage: CGImage) -> GrayImage? {
    let size = GrayImage.fittingSize(
      width: cgImage.width,
      height: cgImage.height,
      maxSide: ImageMetrics.analysisMaxSide
    )
    var pixels = [UInt8](repeating: 0, count: size.width * size.height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard
        let context = CGContext(
          data: buffer.baseAddress,
          width: size.width,
          height: size.height,
          bitsPerComponent: 8,
          bytesPerRow: size.width,
          space: CGColorSpaceCreateDeviceGray(),
          bitmapInfo: CGImageAlphaInfo.none.rawValue
        )
      else {
        return false
      }
      context.interpolationQuality = .medium
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: size.width, height: size.height))
      return true
    }
    guard drawn else { return nil }
    return GrayImage(width: size.width, height: size.height, pixels: pixels)
  }

  static var supportsVisionFingerprint: Bool {
    #if targetEnvironment(simulator)
      return false
    #else
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    #endif
  }

  static var preferredFingerprintKind: FingerprintKind {
    supportsVisionFingerprint ? .vision : .dhash
  }

  static func featurePrint(_ cgImage: CGImage) -> [Float]? {
    guard #available(iOS 17.0, *) else {
      return nil
    }
    let request = VNGenerateImageFeaturePrintRequest()
    request.revision = VNGenerateImageFeaturePrintRequestRevision2
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return nil
    }
    guard let observation = request.results?.first, let values = vector(from: observation) else {
      return nil
    }
    return FeatureVector.isInformative(values) ? values : nil
  }

  private static func vector(from observation: VNFeaturePrintObservation) -> [Float]? {
    let count = observation.elementCount
    guard count > 0 else { return nil }
    let data = observation.data
    switch observation.elementType {
    case .float:
      return data.withUnsafeBytes { Array($0.bindMemory(to: Float.self).prefix(count)) }
    case .double:
      return data.withUnsafeBytes { $0.bindMemory(to: Double.self).prefix(count).map { Float($0) } }
    default:
      return nil
    }
  }
}
