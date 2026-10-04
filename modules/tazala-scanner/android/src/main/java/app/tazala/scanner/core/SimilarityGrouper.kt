package app.tazala.scanner.core

enum class SimilarityLevel(val dhashThreshold: Int) {
  LOW(6),
  MEDIUM(10),
  HIGH(14);

  companion object {
    fun parse(value: String): SimilarityLevel = when (value) {
      "low" -> LOW
      "high" -> HIGH
      else -> MEDIUM
    }
  }
}

const val FINGERPRINT_KIND_DHASH = "dhash-v1"

class SimilarityGrouper(private val windowMs: Long, private val dhashThreshold: Int) {
  private class Cluster(val members: MutableList<Pair<Int, Long>>, var lastCreatedAt: Long)

  private val clusters = ArrayList<Cluster>()
  private val active = ArrayList<Cluster>()
  private var count = 0
  private var lastCreatedAt = Long.MIN_VALUE

  var comparisons = 0L
    private set

  fun add(createdAt: Long, hash: Long): Int {
    val index = count++
    val timestamp = maxOf(createdAt, lastCreatedAt)
    lastCreatedAt = timestamp
    val cutoff = timestamp - windowMs
    active.removeAll { it.lastCreatedAt < cutoff }

    var best: Cluster? = null
    var bestWorst = Int.MAX_VALUE
    for (cluster in active) {
      var worst = 0
      var matches = true
      for ((_, memberHash) in cluster.members) {
        comparisons++
        val distance = ImageMetrics.hammingDistance(memberHash, hash)
        if (distance > dhashThreshold) {
          matches = false
          break
        }
        worst = maxOf(worst, distance)
      }
      if (matches && worst < bestWorst) {
        best = cluster
        bestWorst = worst
      }
    }

    val target = best
    if (target != null) {
      target.members.add(Pair(index, hash))
      target.lastCreatedAt = timestamp
    } else {
      val created = Cluster(mutableListOf(Pair(index, hash)), timestamp)
      clusters.add(created)
      active.add(created)
    }
    return index
  }

  fun groups(): List<List<Int>> =
    clusters.filter { it.members.size > 1 }.map { cluster -> cluster.members.map { it.first } }.sortedBy { it.first() }
}
