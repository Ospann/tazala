import Foundation
import Photos

struct ScanCallbacks {
  let progress: (_ processed: Int, _ total: Int) -> Void
  let batch: (_ analyses: [[String: Any]]) -> Void
  let complete: (_ durationMs: Double, _ processed: Int, _ cancelled: Bool) -> Void
}

final class ScanSession {
  private let condition = NSCondition()
  private var paused = false
  private var cancelled = false
  private let queue = DispatchQueue(label: "app.tazala.scanner.session", qos: .utility)

  func pause() {
    condition.lock()
    paused = true
    condition.unlock()
  }

  func resume() {
    condition.lock()
    paused = false
    condition.broadcast()
    condition.unlock()
  }

  func cancel() {
    condition.lock()
    cancelled = true
    paused = false
    condition.broadcast()
    condition.unlock()
  }

  var isPaused: Bool {
    condition.lock()
    defer { condition.unlock() }
    return paused
  }

  func run(
    assets: [PHAsset],
    batchSize: Int,
    concurrency: Int,
    callbacks: ScanCallbacks
  ) {
    queue.async { [self] in
      let start = DispatchTime.now().uptimeNanoseconds
      let analyzer = AssetAnalyzer()
      let operations = OperationQueue()
      operations.maxConcurrentOperationCount = min(max(concurrency, 1), 4)
      operations.qualityOfService = .utility

      let total = assets.count
      var processed = 0
      callbacks.progress(0, total)

      var offset = 0
      while offset < total {
        guard waitWhilePaused() else { break }
        let end = min(offset + max(batchSize, 1), total)
        let slice = Array(assets[offset..<end])
        var results = [[String: Any]?](repeating: nil, count: slice.count)
        let resultsLock = NSLock()

        for (index, asset) in slice.enumerated() {
          operations.addOperation {
            let analysis = autoreleasepool { analyzer.analyze(asset).dictionary }
            resultsLock.lock()
            results[index] = analysis
            resultsLock.unlock()
          }
        }
        operations.waitUntilAllOperationsAreFinished()

        let batch = results.compactMap { $0 }
        processed += batch.count
        offset = end
        callbacks.batch(batch)
        callbacks.progress(processed, total)
      }

      let wasCancelled = isCancelled
      let durationMs = Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
      callbacks.complete(durationMs, processed, wasCancelled)
    }
  }

  private var isCancelled: Bool {
    condition.lock()
    defer { condition.unlock() }
    return cancelled
  }

  private func waitWhilePaused() -> Bool {
    condition.lock()
    defer { condition.unlock() }
    while paused && !cancelled {
      condition.wait()
    }
    return !cancelled
  }
}
