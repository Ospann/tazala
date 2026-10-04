package app.tazala.scanner

import android.os.SystemClock
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.thread
import kotlin.concurrent.withLock

interface ScanListener {
  fun onProgress(processed: Int, total: Int)
  fun onBatch(analyses: List<Map<String, Any?>>)
  fun onComplete(durationMs: Double, processed: Int, cancelled: Boolean)
  fun onError(message: String)
}

class ScanSession(
  private val analyzer: AssetAnalyzer,
  private val listener: ScanListener,
) {
  private val lock = ReentrantLock()
  private val resumed = lock.newCondition()
  private var paused = false
  private var cancelled = false

  fun pause() = lock.withLock { paused = true }

  fun resume() = lock.withLock {
    paused = false
    resumed.signalAll()
  }

  fun cancel() = lock.withLock {
    cancelled = true
    paused = false
    resumed.signalAll()
  }

  fun start(assets: List<MediaAsset>, batchSize: Int, concurrency: Int) {
    thread(name = "tazala-scan", priority = Thread.NORM_PRIORITY - 1) {
      val started = SystemClock.elapsedRealtime()
      val pool = Executors.newFixedThreadPool(concurrency.coerceIn(1, 4))
      var processed = 0
      try {
        val total = assets.size
        listener.onProgress(0, total)
        for (batch in assets.chunked(batchSize.coerceAtLeast(1))) {
          if (!waitWhilePaused()) break
          val results = pool.invokeAll(batch.map { asset -> Callable { analyzer.analyze(asset) } })
            .map { it.get() }
          processed += results.size
          listener.onBatch(results)
          listener.onProgress(processed, total)
        }
      } catch (error: Exception) {
        listener.onError(error.message ?: error.javaClass.simpleName)
      } finally {
        pool.shutdownNow()
        val wasCancelled = lock.withLock { cancelled }
        listener.onComplete((SystemClock.elapsedRealtime() - started).toDouble(), processed, wasCancelled)
      }
    }
  }

  private fun waitWhilePaused(): Boolean = lock.withLock {
    while (paused && !cancelled) {
      resumed.await()
    }
    !cancelled
  }
}
