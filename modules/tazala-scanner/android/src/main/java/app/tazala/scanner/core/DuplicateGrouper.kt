package app.tazala.scanner.core

import kotlin.math.abs

data class DuplicateTolerance(
  val maxPixelDifference: Int,
  val maxMeanDifference: Double,
  val maxSharpnessRatio: Double,
) {
  fun similarSharpness(a: Double, b: Double): Boolean =
    maxOf(maxOf(a, b), 0.001) / maxOf(minOf(a, b), 0.001) <= maxSharpnessRatio

  fun matches(a: ByteArray, b: ByteArray): Boolean {
    if (a.size != b.size || a.isEmpty()) return false
    var total = 0
    for (index in a.indices) {
      val difference = abs((a[index].toInt() and 0xff) - (b[index].toInt() and 0xff))
      if (difference > maxPixelDifference) return false
      total += difference
    }
    return total.toDouble() / a.size <= maxMeanDifference
  }

  companion object {
    val STANDARD = DuplicateTolerance(maxPixelDifference = 8, maxMeanDifference = 2.5, maxSharpnessRatio = 1.6)
  }
}

class DuplicateGrouper(private val tolerance: DuplicateTolerance = DuplicateTolerance.STANDARD) {
  private class Entry(val index: Int, val mean: Double, val signature: ByteArray, val sharpness: Double)

  private val buckets = HashMap<Pair<Int, Int>, MutableList<Entry>>()
  private var count = 0

  var comparisons = 0L
    private set

  fun add(width: Int, height: Int, signature: ByteArray, sharpness: Double): Int {
    val index = count++
    val mean = if (signature.isEmpty()) 0.0 else signature.sumOf { it.toInt() and 0xff }.toDouble() / signature.size
    buckets.getOrPut(Pair(width, height)) { mutableListOf() }.add(Entry(index, mean, signature, sharpness))
    return index
  }

  fun groups(): List<List<Int>> {
    val parent = IntArray(count) { it }
    fun find(index: Int): Int {
      var root = index
      while (parent[root] != root) root = parent[root]
      var current = index
      while (parent[current] != root) {
        val next = parent[current]
        parent[current] = root
        current = next
      }
      return root
    }

    for (entries in buckets.values) {
      if (entries.size < 2) continue
      val sorted = entries.sortedBy { it.mean }
      for (position in sorted.indices) {
        val current = sorted[position]
        var next = position + 1
        while (next < sorted.size && sorted[next].mean - current.mean <= tolerance.maxMeanDifference) {
          comparisons++
          if (tolerance.similarSharpness(current.sharpness, sorted[next].sharpness) &&
            tolerance.matches(current.signature, sorted[next].signature)
          ) {
            val rootA = find(current.index)
            val rootB = find(sorted[next].index)
            if (rootA != rootB) parent[maxOf(rootA, rootB)] = minOf(rootA, rootB)
          }
          next++
        }
      }
    }

    val grouped = LinkedHashMap<Int, MutableList<Int>>()
    for (index in 0 until count) {
      grouped.getOrPut(find(index)) { mutableListOf() }.add(index)
    }
    return grouped.values.filter { it.size > 1 }.sortedBy { it.first() }
  }
}
