import ExpoModulesCore
import Photos
import PhotosUI
import UIKit

struct ScanOptionsRecord: Record {
  @Field var assetIds: [String]? = nil
  @Field var batchSize: Int = 100
  @Field var concurrency: Int = 3
}

struct GroupingOptionsRecord: Record {
  @Field var databasePath: String = ""
  @Field var level: String = "medium"
  @Field var windowMs: Double = 600_000
}

final class ScanAlreadyRunningException: Exception, @unchecked Sendable {
  override var reason: String { "A scan is already running" }
}

final class PermissionRequiredException: Exception, @unchecked Sendable {
  override var reason: String { "Photo library access has not been granted" }
}

final class GroupingFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}

final class NoViewControllerException: Exception, @unchecked Sendable {
  override var reason: String { "No view controller is available to present the picker" }
}

private final class LibraryChangeObserver: NSObject, PHPhotoLibraryChangeObserver {
  var onChange: (() -> Void)?

  func photoLibraryDidChange(_ changeInstance: PHChange) {
    onChange?()
  }
}

public class TazalaScannerModule: Module {
  static let moduleVersion = "0.2.0"

  private let library = PhotoLibrary()
  private let sessionLock = NSLock()
  private var session: ScanSession?
  private let changeObserver = LibraryChangeObserver()
  private var observingLibrary = false

  public func definition() -> ModuleDefinition {
    Name("TazalaScanner")

    Constant("platform") { "ios" }
    Constant("moduleVersion") { Self.moduleVersion }
    Constant("analysisVersion") { AssetAnalyzer.analysisVersion }
    Constant("fingerprintKind") { AssetAnalyzer.preferredFingerprintKind.rawValue }

    Events("onScanProgress", "onScanBatch", "onScanComplete", "onScanError", "onLibraryChange")

    OnStartObserving("onLibraryChange") {
      self.startObservingLibrary()
    }

    OnStopObserving("onLibraryChange") {
      self.stopObservingLibrary()
    }

    OnDestroy {
      self.currentSession()?.cancel()
      self.stopObservingLibrary()
    }

    AsyncFunction("ping") { () -> [String: String] in
      [
        "platform": "ios",
        "osVersion": ProcessInfo.processInfo.operatingSystemVersionString,
        "moduleVersion": Self.moduleVersion,
      ]
    }

    AsyncFunction("getPermissionStatus") { () -> String in
      self.library.permissionStatus().rawValue
    }

    AsyncFunction("requestPermission") { () async -> String in
      let status = await self.library.requestPermission()
      if status == .granted || status == .limited {
        self.startObservingLibraryIfNeeded()
      }
      return status.rawValue
    }

    AsyncFunction("presentLimitedLibraryPicker") { () async throws in
      try await self.presentLimitedPicker()
    }

    AsyncFunction("getLibraryStats") { () throws -> [String: Any] in
      try self.requireAccess()
      return self.library.stats()
    }

    AsyncFunction("listAssets") { (offset: Int, limit: Int) throws -> [[String: Any]] in
      try self.requireAccess()
      return self.library.listAssets(offset: offset, limit: limit)
    }

    AsyncFunction("startScan") { (options: ScanOptionsRecord) throws in
      try self.requireAccess()
      try self.startScan(options)
    }

    Function("pauseScan") {
      self.currentSession()?.pause()
    }

    Function("resumeScan") {
      self.currentSession()?.resume()
    }

    Function("cancelScan") {
      self.currentSession()?.cancel()
    }

    Function("isScanning") { () -> Bool in
      self.currentSession() != nil
    }

    AsyncFunction("findSimilarGroups") { (options: GroupingOptionsRecord) throws -> [String: Any] in
      let level = SimilarityLevel(rawValue: options.level) ?? .medium
      let started = DispatchTime.now().uptimeNanoseconds
      do {
        let result = try SimilarityStore.findGroups(
          databasePath: options.databasePath,
          level: level,
          windowMs: Int64(options.windowMs)
        )
        return [
          "groups": result.groups,
          "duplicates": result.duplicates,
          "comparisons": result.comparisons,
          "itemCount": result.itemCount,
          "durationMs": Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000,
        ]
      } catch {
        throw GroupingFailedException(String(describing: error))
      }
    }

    AsyncFunction("deleteAssets") { (ids: [String]) async throws -> [String: Any] in
      try self.requireAccess()
      return await AssetDeleter.delete(identifiers: ids, library: self.library).dictionary
    }

    Function("getMemoryUsage") { () -> Double in
      Self.physicalFootprint()
    }
  }

  private func requireAccess() throws {
    guard library.hasAccess else {
      throw PermissionRequiredException()
    }
  }

  private func currentSession() -> ScanSession? {
    sessionLock.lock()
    defer { sessionLock.unlock() }
    return session
  }

  private func startScan(_ options: ScanOptionsRecord) throws {
    sessionLock.lock()
    if session != nil {
      sessionLock.unlock()
      throw ScanAlreadyRunningException()
    }
    let newSession = ScanSession()
    session = newSession
    sessionLock.unlock()

    let assets = library.photoAssets(withIdentifiers: options.assetIds)
    newSession.run(
      assets: assets,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      callbacks: ScanCallbacks(
        progress: { [weak self] processed, total in
          self?.sendEvent("onScanProgress", ["processed": processed, "total": total])
        },
        batch: { [weak self] analyses in
          guard !analyses.isEmpty else { return }
          self?.sendEvent("onScanBatch", ["analyses": analyses])
        },
        complete: { [weak self] durationMs, processed, cancelled in
          guard let self else { return }
          self.sessionLock.lock()
          if self.session === newSession {
            self.session = nil
          }
          self.sessionLock.unlock()
          self.sendEvent(
            "onScanComplete",
            ["durationMs": durationMs, "processed": processed, "cancelled": cancelled]
          )
        }
      )
    )
  }

  @MainActor
  private func presentLimitedPicker() async throws {
    guard let controller = appContext?.utilities?.currentViewController() else {
      throw NoViewControllerException()
    }
    _ = await PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: controller)
  }

  private func startObservingLibrary() {
    observingLibrary = true
    startObservingLibraryIfNeeded()
  }

  private var observerRegistered = false

  private func startObservingLibraryIfNeeded() {
    guard observingLibrary, !observerRegistered, library.hasAccess else { return }
    changeObserver.onChange = { [weak self] in
      self?.sendEvent("onLibraryChange", [:])
    }
    PHPhotoLibrary.shared().register(changeObserver)
    observerRegistered = true
  }

  private func stopObservingLibrary() {
    observingLibrary = false
    guard observerRegistered else { return }
    PHPhotoLibrary.shared().unregisterChangeObserver(changeObserver)
    observerRegistered = false
  }

  private static func physicalFootprint() -> Double {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
    let result = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return result == KERN_SUCCESS ? Double(info.phys_footprint) : 0
  }
}
