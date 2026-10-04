package app.tazala.scanner

import android.Manifest
import android.content.Context
import android.database.ContentObserver
import android.os.Build
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import app.tazala.scanner.core.FINGERPRINT_KIND_DHASH
import app.tazala.scanner.core.SimilarityLevel

class ScanOptionsRecord : Record {
  @Field
  val assetIds: List<String>? = null

  @Field
  val batchSize: Int = 100

  @Field
  val concurrency: Int = 3
}

class GroupingOptionsRecord : Record {
  @Field
  val databasePath: String = ""

  @Field
  val level: String = "medium"

  @Field
  val windowMs: Double = 600_000.0
}

class ScanAlreadyRunningException : CodedException("A scan is already running")

class PermissionRequiredException : CodedException("Photo library access has not been granted")

class TazalaScannerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val library by lazy { MediaLibrary(context.contentResolver) }
  private val deleter by lazy { AssetDeleter(context.contentResolver, library) { appContext.currentActivity } }

  @Volatile
  private var session: ScanSession? = null
  private var observer: ContentObserver? = null

  override fun definition() = ModuleDefinition {
    Name("TazalaScanner")

    Constant("platform") { "android" }
    Constant("moduleVersion") { MODULE_VERSION }
    Constant("analysisVersion") { AssetAnalyzer.ANALYSIS_VERSION }
    Constant("fingerprintKind") { FINGERPRINT_KIND_DHASH }

    Events("onScanProgress", "onScanBatch", "onScanComplete", "onScanError", "onLibraryChange")

    OnStartObserving("onLibraryChange") {
      startObservingLibrary()
    }

    OnStopObserving("onLibraryChange") {
      stopObservingLibrary()
    }

    OnDestroy {
      session?.cancel()
      stopObservingLibrary()
    }

    OnActivityResult { _, payload ->
      deleter.onActivityResult(payload.requestCode, payload.resultCode)
    }

    AsyncFunction("ping") {
      mapOf(
        "platform" to "android",
        "osVersion" to "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
        "moduleVersion" to MODULE_VERSION,
      )
    }

    AsyncFunction("getPermissionStatus") { promise: Promise ->
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(fallbackStatus())
      permissions.getPermissions({ result -> promise.resolve(mapStatus(result)) }, *requiredPermissions())
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(fallbackStatus())
      permissions.askForPermissions({ result ->
        val status = mapStatus(result)
        promise.resolve(if (status == "undetermined") "denied" else status)
      }, *requestedPermissions())
    }

    AsyncFunction("presentLimitedLibraryPicker") { promise: Promise ->
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(null)
      permissions.askForPermissions({ promise.resolve(null) }, *requestedPermissions())
    }

    AsyncFunction("getLibraryStats") {
      requireAccess()
      library.stats()
    }

    AsyncFunction("listAssets") { offset: Int, limit: Int ->
      requireAccess()
      library.list(offset, limit).map { it.toMap() }
    }

    AsyncFunction("startScan") { options: ScanOptionsRecord ->
      requireAccess()
      startScan(options)
    }

    Function("pauseScan") { session?.pause() }

    Function("resumeScan") { session?.resume() }

    Function("cancelScan") { session?.cancel() }

    Function("isScanning") { session != null }

    AsyncFunction("findSimilarGroups") { options: GroupingOptionsRecord ->
      val started = SystemClock.elapsedRealtime()
      val result = SimilarityStore.findGroups(
        options.databasePath,
        SimilarityLevel.parse(options.level),
        options.windowMs.toLong(),
      )
      mapOf(
        "groups" to result.groups,
        "duplicates" to result.duplicates,
        "comparisons" to result.comparisons.toDouble(),
        "itemCount" to result.itemCount,
        "durationMs" to (SystemClock.elapsedRealtime() - started).toDouble(),
      )
    }

    AsyncFunction("deleteAssets") { ids: List<String>, promise: Promise ->
      requireAccess()
      deleter.delete(ids, promise)
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)

    Function("getMemoryUsage") {
      val info = Debug.MemoryInfo()
      Debug.getMemoryInfo(info)
      info.totalPss.toDouble() * 1024
    }
  }

  private fun startScan(options: ScanOptionsRecord) {
    synchronized(this) {
      if (session != null) throw ScanAlreadyRunningException()
      val assets = library.photos(options.assetIds)
      lateinit var created: ScanSession
      created = ScanSession(AssetAnalyzer(context.contentResolver), object : ScanListener {
        override fun onProgress(processed: Int, total: Int) {
          sendEvent("onScanProgress", mapOf("processed" to processed, "total" to total))
        }

        override fun onBatch(analyses: List<Map<String, Any?>>) {
          if (analyses.isNotEmpty()) sendEvent("onScanBatch", mapOf("analyses" to analyses))
        }

        override fun onComplete(durationMs: Double, processed: Int, cancelled: Boolean) {
          synchronized(this@TazalaScannerModule) {
            if (session === created) session = null
          }
          sendEvent(
            "onScanComplete",
            mapOf("durationMs" to durationMs, "processed" to processed, "cancelled" to cancelled),
          )
        }

        override fun onError(message: String) {
          sendEvent("onScanError", mapOf("message" to message))
        }
      })
      session = created
      created.start(assets, options.batchSize, options.concurrency)
    }
  }

  private fun requiredPermissions(): Array<String> = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
      Manifest.permission.READ_MEDIA_IMAGES,
      Manifest.permission.READ_MEDIA_VIDEO,
      Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
    )
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
      Manifest.permission.READ_MEDIA_IMAGES,
      Manifest.permission.READ_MEDIA_VIDEO,
    )
    else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
  }

  private fun requestedPermissions(): Array<String> =
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
      requiredPermissions() + Manifest.permission.WRITE_EXTERNAL_STORAGE
    } else {
      requiredPermissions()
    }

  private fun mapStatus(result: Map<String, PermissionsResponse>): String {
    fun granted(permission: String) = result[permission]?.status == PermissionsStatus.GRANTED
    val full = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
        granted(Manifest.permission.READ_MEDIA_IMAGES) && granted(Manifest.permission.READ_MEDIA_VIDEO)
      else -> granted(Manifest.permission.READ_EXTERNAL_STORAGE)
    }
    if (full) return "granted"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
      granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
    ) {
      return "limited"
    }
    val undetermined = result.values.all { it.status == PermissionsStatus.UNDETERMINED }
    return if (undetermined) "undetermined" else "denied"
  }

  private fun fallbackStatus(): String = if (hasAccess()) "granted" else "undetermined"

  private fun hasAccess(): Boolean {
    val ctx = appContext.reactContext ?: return false
    fun granted(permission: String) =
      ctx.checkSelfPermission(permission) == android.content.pm.PackageManager.PERMISSION_GRANTED
    return requiredPermissions().any { granted(it) }
  }

  private fun requireAccess() {
    if (!hasAccess()) throw PermissionRequiredException()
  }

  private fun startObservingLibrary() {
    if (observer != null) return
    val created = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean) {
        sendEvent("onLibraryChange", emptyMap<String, Any>())
      }
    }
    context.contentResolver.registerContentObserver(MediaLibrary.FILES_URI, true, created)
    observer = created
  }

  private fun stopObservingLibrary() {
    val current = observer ?: return
    appContext.reactContext?.contentResolver?.unregisterContentObserver(current)
    observer = null
  }

  companion object {
    const val MODULE_VERSION = "0.2.0"
  }
}
