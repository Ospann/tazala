package app.tazala.scanner

import android.app.Activity
import android.app.RecoverableSecurityException
import android.content.ContentResolver
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException

class DeletionInProgressException : CodedException("A deletion request is already waiting for the user")

class NoActivityException : CodedException("No foreground activity is available to confirm deletion")

class AssetDeleter(
  private val resolver: ContentResolver,
  private val library: MediaLibrary,
  private val activityProvider: () -> Activity?,
) {
  private class Pending(
    val promise: Promise,
    val targets: List<Long>,
    val missing: List<Long>,
    val remainingLegacy: ArrayDeque<Pair<Long, Uri>>,
    var currentLegacy: Pair<Long, Uri>?,
  )

  private var pending: Pending? = null

  fun delete(ids: List<String>, promise: Promise) {
    if (pending != null) {
      promise.reject(DeletionInProgressException())
      return
    }
    val requested = ids.mapNotNull { it.toLongOrNull() }.distinct()
    val existing = library.existing(requested)
    val missing = requested.filter { it !in existing }
    val targets = requested.filter { it in existing }
    if (targets.isEmpty()) {
      promise.resolve(result(emptyList(), emptyList(), missing, false))
      return
    }
    val uris = targets.map { id -> MediaLibrary.contentUri(id, existing.getValue(id)) }

    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
        val activity = activityProvider() ?: return promise.reject(NoActivityException())
        val request = MediaStore.createDeleteRequest(resolver, uris)
        pending = Pending(promise, targets, missing, ArrayDeque(), null)
        try {
          activity.startIntentSenderForResult(request.intentSender, REQUEST_CODE, null, 0, 0, 0)
        } catch (error: Exception) {
          pending = null
          promise.reject(CodedException(error.message ?: "Cannot open the delete confirmation", error))
        }
      }
      else -> {
        val queue = ArrayDeque(targets.zip(uris))
        pending = Pending(promise, targets, missing, queue, null)
        continueLegacy()
      }
    }
  }

  fun onActivityResult(requestCode: Int, resultCode: Int) {
    if (requestCode != REQUEST_CODE) return
    val current = pending ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      finish(current, cancelled = resultCode != Activity.RESULT_OK)
      return
    }
    if (resultCode != Activity.RESULT_OK) {
      finish(current, cancelled = true)
      return
    }
    current.currentLegacy?.let { (_, uri) -> deleteQuietly(uri) }
    current.currentLegacy = null
    continueLegacy()
  }

  private fun continueLegacy() {
    val current = pending ?: return
    while (current.remainingLegacy.isNotEmpty()) {
      val next = current.remainingLegacy.removeFirst()
      try {
        resolver.delete(next.second, null, null)
      } catch (error: SecurityException) {
        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q && error is RecoverableSecurityException) {
          val activity = activityProvider()
          if (activity != null) {
            current.currentLegacy = next
            try {
              activity.startIntentSenderForResult(
                error.userAction.actionIntent.intentSender,
                REQUEST_CODE,
                null,
                0,
                0,
                0,
              )
              return
            } catch (_: Exception) {
              current.currentLegacy = null
            }
          }
        }
      }
    }
    finish(current, cancelled = false)
  }

  private fun deleteQuietly(uri: Uri) {
    try {
      resolver.delete(uri, null, null)
    } catch (_: SecurityException) {
    }
  }

  private fun finish(current: Pending, cancelled: Boolean) {
    pending = null
    val stillExisting = library.existing(current.targets)
    val deleted = current.targets.filter { it !in stillExisting }
    val failed = current.targets.filter { it in stillExisting }
    current.promise.resolve(result(deleted, failed, current.missing, cancelled && deleted.isEmpty()))
  }

  private fun result(deleted: List<Long>, failed: List<Long>, missing: List<Long>, cancelled: Boolean) = mapOf(
    "deletedIds" to deleted.map { it.toString() },
    "failedIds" to failed.map { it.toString() },
    "missingIds" to missing.map { it.toString() },
    "cancelled" to cancelled,
  )

  companion object {
    const val REQUEST_CODE = 0x7a5a
  }
}
