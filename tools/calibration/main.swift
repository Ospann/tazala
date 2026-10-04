import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

struct Sample {
  let name: String
  let group: String
  let kind: String
  let image: CGImage
}

let context = CIContext()

func load(_ url: URL) -> CGImage? {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func render(_ image: CIImage, extent: CGRect) -> CGImage? {
  context.createCGImage(image, from: extent)
}

func jpegRoundTrip(_ cgImage: CGImage, quality: Double) -> CGImage? {
  let data = NSMutableData()
  guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
  CGImageDestinationAddImage(destination, cgImage, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
  guard CGImageDestinationFinalize(destination), let source = CGImageSourceCreateWithData(data, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func variants(of cgImage: CGImage) -> [(String, String, CGImage)] {
  let input = CIImage(cgImage: cgImage)
  let extent = input.extent
  var result: [(String, String, CGImage)] = []

  let cropRect = extent.insetBy(dx: extent.width * 0.04, dy: extent.height * 0.04).offsetBy(dx: extent.width * 0.02, dy: 0)
  if let crop = render(input.cropped(to: cropRect), extent: cropRect) { result.append(("shift-crop", "similar", crop)) }

  let exposure = CIFilter.exposureAdjust()
  exposure.inputImage = input
  exposure.ev = 0.35
  if let out = exposure.outputImage, let image = render(out, extent: extent) { result.append(("brighter", "similar", image)) }

  let rotate = input.transformed(by: CGAffineTransform(rotationAngle: 0.035))
  let rotatedRect = extent.insetBy(dx: extent.width * 0.06, dy: extent.height * 0.06)
  if let image = render(rotate.cropped(to: rotatedRect), extent: rotatedRect) { result.append(("tilt", "similar", image)) }

  if let image = jpegRoundTrip(cgImage, quality: 0.5) { result.append(("jpeg50", "similar", image)) }

  let scaled = input.transformed(by: CGAffineTransform(scaleX: 0.7, y: 0.7))
  if let image = render(scaled, extent: scaled.extent) { result.append(("downscaled", "similar", image)) }

  if let copy = render(input, extent: extent) { result.append(("copy", "duplicate", copy)) }

  for radius in [1.5, 3.0] {
    let blur = CIFilter.gaussianBlur()
    blur.inputImage = input.clampedToExtent()
    blur.radius = Float(radius)
    if let out = blur.outputImage, let image = render(out.cropped(to: extent), extent: extent) {
      result.append(("blur\(radius)", "blur", image))
    }
  }
  return result
}

func gray(_ cgImage: CGImage) -> GrayImage {
  let size = GrayImage.fittingSize(width: cgImage.width, height: cgImage.height, maxSide: ImageMetrics.analysisMaxSide)
  var pixels = [UInt8](repeating: 0, count: size.width * size.height)
  pixels.withUnsafeMutableBytes { buffer in
    let ctx = CGContext(data: buffer.baseAddress, width: size.width, height: size.height, bitsPerComponent: 8,
                        bytesPerRow: size.width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    ctx.interpolationQuality = .medium
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: size.width, height: size.height))
  }
  return GrayImage(width: size.width, height: size.height, pixels: pixels)!
}

func featurePrint(_ cgImage: CGImage) -> [Float] {
  let request = VNGenerateImageFeaturePrintRequest()
  request.revision = VNGenerateImageFeaturePrintRequestRevision2
  try! VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
  let observation = request.results!.first!
  return observation.data.withUnsafeBytes { Array($0.bindMemory(to: Float.self).prefix(observation.elementCount)) }
}

struct Measured {
  let sample: Sample
  let vision: [Float]
  let dhash: UInt64
  let blur: Double
  let signature: [UInt8]
}

func stats(_ values: [Double]) -> String {
  guard !values.isEmpty else { return "n=0" }
  let sorted = values.sorted()
  func pct(_ p: Double) -> Double { sorted[min(sorted.count - 1, Int(Double(sorted.count - 1) * p))] }
  return String(format: "n=%d min=%.3f p05=%.3f p50=%.3f p95=%.3f max=%.3f", sorted.count, sorted[0], pct(0.05), pct(0.5), pct(0.95), sorted.last!)
}

let directory = URL(fileURLWithPath: CommandLine.arguments[1])
let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
  .filter { ["heic", "jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

var samples: [Sample] = []
for file in files {
  guard let image = load(file) else { continue }
  let base = file.deletingPathExtension().lastPathComponent
  samples.append(Sample(name: base, group: base, kind: "original", image: image))
  for (name, kind, variant) in variants(of: image) {
    samples.append(Sample(name: "\(base)#\(name)", group: base, kind: kind, image: variant))
  }
}

let measured = samples.map { sample -> Measured in
  let g = gray(sample.image)
  return Measured(sample: sample, vision: featurePrint(sample.image), dhash: ImageMetrics.dHash(g),
                  blur: ImageMetrics.laplacianVariance(g), signature: ImageMetrics.signature(g))
}

let originals = measured.filter { $0.sample.kind == "original" }
var similarVision: [Double] = [], similarHash: [Double] = []
var differentVision: [Double] = [], differentHash: [Double] = []
var duplicateExactMatches = 0, duplicateTotal = 0, exactCollisions = 0
var sharpBlur: [Double] = [], blurredBlur: [Double] = []

for original in originals {
  sharpBlur.append(original.blur)
  for item in measured where item.sample.group == original.sample.group && item.sample.kind != "original" {
    switch item.sample.kind {
    case "similar":
      similarVision.append(Double(FeatureVector.distance(original.vision, item.vision)))
      similarHash.append(Double(ImageMetrics.hammingDistance(original.dhash, item.dhash)))
    case "duplicate":
      duplicateTotal += 1
      if DuplicateTolerance.standard.matches(item.signature, original.signature), DuplicateTolerance.standard.similarSharpness(item.blur, original.blur) { duplicateExactMatches += 1 }
    case "blur":
      blurredBlur.append(item.blur)
    default:
      break
    }
  }
}
for (i, a) in originals.enumerated() {
  for b in originals[(i + 1)...] {
    differentVision.append(Double(FeatureVector.distance(a.vision, b.vision)))
    differentHash.append(Double(ImageMetrics.hammingDistance(a.dhash, b.dhash)))
    if DuplicateTolerance.standard.matches(a.signature, b.signature) { exactCollisions += 1 }
  }
}

print("images: \(originals.count) originals, \(measured.count) samples")
print("vision similar   : \(stats(similarVision))")
print("vision different : \(stats(differentVision))")
print("dhash  similar   : \(stats(similarHash))")
print("dhash  different : \(stats(differentHash))")
print("blur   sharp     : \(stats(sharpBlur))")
print("blur   blurred   : \(stats(blurredBlur))")
print("exact duplicates matched: \(duplicateExactMatches)/\(duplicateTotal), collisions between different: \(exactCollisions)")

func rates(_ positives: [Double], _ negatives: [Double], _ threshold: Double) -> String {
  let recall = Double(positives.filter { $0 <= threshold }.count) / Double(max(positives.count, 1))
  let falsePositive = Double(negatives.filter { $0 <= threshold }.count) / Double(max(negatives.count, 1))
  return String(format: "t=%.2f recall=%.2f fpr=%.3f", threshold, recall, falsePositive)
}
print("vision thresholds:")
for t in [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8] { print("  " + rates(similarVision, differentVision, t)) }
print("dhash thresholds:")
for t in [4.0, 6, 8, 10, 12, 14, 16, 18] { print("  " + rates(similarHash, differentHash, t)) }
print("blur thresholds (fraction of blurred below / sharp below):")
for t in [20.0, 40, 60, 80, 100, 150, 200, 300] {
  let caught = Double(blurredBlur.filter { $0 < t }.count) / Double(max(blurredBlur.count, 1))
  let wrong = Double(sharpBlur.filter { $0 < t }.count) / Double(max(sharpBlur.count, 1))
  print(String(format: "  t=%.0f blurred=%.2f sharp=%.2f", t, caught, wrong))
}

func quantizedHash(_ image: GrayImage, side: Int, shift: UInt8) -> String {
  let small = image.resized(width: side, height: side)
  var hash: UInt64 = 0xcbf2_9ce4_8422_2325
  for pixel in small.pixels {
    hash ^= UInt64(pixel >> shift)
    hash = hash &* 0x0000_0100_0000_01b3
  }
  return String(format: "%016llx", hash)
}

print("exact hash schemes (copy match / jpeg50 match / brighter match / collisions between different):")
let grays = Dictionary(uniqueKeysWithValues: measured.map { ($0.sample.name, gray($0.sample.image)) })
for (side, shift) in [(16, 3), (16, 4), (8, 4), (8, 5), (6, 5), (4, 5)] {
  var copy = 0, jpeg = 0, bright = 0, collisions = 0
  for original in originals {
    let base = quantizedHash(grays[original.sample.name]!, side: side, shift: UInt8(shift))
    for suffix in ["copy", "jpeg50", "brighter"] {
      guard let variant = grays["\(original.sample.name)#\(suffix)"] else { continue }
      if quantizedHash(variant, side: side, shift: UInt8(shift)) == base {
        if suffix == "copy" { copy += 1 } else if suffix == "jpeg50" { jpeg += 1 } else { bright += 1 }
      }
    }
  }
  for (i, a) in originals.enumerated() {
    for b in originals[(i + 1)...] where quantizedHash(grays[a.sample.name]!, side: side, shift: UInt8(shift)) == quantizedHash(grays[b.sample.name]!, side: side, shift: UInt8(shift)) {
      collisions += 1
    }
  }
  print("  \(side)x\(side)>>\(shift): copy \(copy)/\(originals.count) jpeg \(jpeg) bright \(bright) collisions \(collisions)")
}
var maxDiffCopy = 0
for original in originals {
  guard let variant = grays["\(original.sample.name)#copy"] else { continue }
  let a = grays[original.sample.name]!.resized(width: 16, height: 16).pixels
  let b = variant.resized(width: 16, height: 16).pixels
  maxDiffCopy = max(maxDiffCopy, zip(a, b).map { abs(Int($0) - Int($1)) }.max() ?? 0)
}
print("max per-pixel diff for copies at 16x16: \(maxDiffCopy)")

func signatureDiff(_ a: GrayImage, _ b: GrayImage) -> (maxDiff: Int, meanDiff: Double) {
  let x = a.resized(width: 16, height: 16).pixels
  let y = b.resized(width: 16, height: 16).pixels
  let diffs = zip(x, y).map { abs(Int($0) - Int($1)) }
  return (diffs.max() ?? 0, Double(diffs.reduce(0, +)) / Double(diffs.count))
}
print("signature diffs (max / mean):")
for suffix in ["copy", "jpeg50", "brighter", "shift-crop", "tilt"] {
  var maxes: [Double] = [], means: [Double] = []
  for original in originals {
    guard let variant = grays["\(original.sample.name)#\(suffix)"] else { continue }
    let d = signatureDiff(grays[original.sample.name]!, variant)
    maxes.append(Double(d.maxDiff)); means.append(d.meanDiff)
  }
  print("  \(suffix): max \(stats(maxes)) | mean \(stats(means))")
}
var differentMins: [Double] = []
for (i, a) in originals.enumerated() {
  for b in originals[(i + 1)...] { differentMins.append(signatureDiff(grays[a.sample.name]!, grays[b.sample.name]!).meanDiff) }
}
print("  different originals mean diff: \(stats(differentMins))")

if CommandLine.arguments.count > 2 {
  let output = URL(fileURLWithPath: CommandLine.arguments[2])
  try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
  for sample in samples where ["original", "duplicate", "similar", "blur"].contains(sample.kind) {
    let name = sample.name.replacingOccurrences(of: "#", with: "_").replacingOccurrences(of: " ", with: "_")
    let url = output.appendingPathComponent("\(name).jpg")
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(destination, sample.image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    CGImageDestinationFinalize(destination)
  }
  print("exported to \(output.path)")
}

print("blur ratio vs original (max/min):")
for suffix in ["copy", "jpeg50", "blur1.5", "blur3.0"] {
  var ratios: [Double] = []
  for original in originals {
    guard let variant = measured.first(where: { $0.sample.name == "\(original.sample.name)#\(suffix)" }) else { continue }
    let a = max(original.blur, 0.001), b = max(variant.blur, 0.001)
    ratios.append(max(a, b) / min(a, b))
  }
  print("  \(suffix): \(stats(ratios))")
}

print("grouping purity (all samples in one window):")
for level in [SimilarityLevel.low, .medium, .high] {
  for useVision in [true, false] {
    var grouper = SimilarityGrouper(windowMs: 600_000, thresholds: .forLevel(level))
    for item in measured {
      grouper.add(createdAt: 0, fingerprint: useVision ? .vision(item.vision) : .dhash(item.dhash))
    }
    let groups = grouper.groups()
    let mixed = groups.filter { Set($0.map { measured[$0].sample.group }).count > 1 }.count
    let grouped = groups.reduce(0) { $0 + $1.count }
    print("  \(level) \(useVision ? "vision" : "dhash "): groups=\(groups.count) grouped=\(grouped)/\(measured.count) mixed=\(mixed)")
  }
}
