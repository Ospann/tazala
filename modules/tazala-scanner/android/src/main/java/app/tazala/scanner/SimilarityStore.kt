package app.tazala.scanner

import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import app.tazala.scanner.core.DuplicateGrouper
import app.tazala.scanner.core.FINGERPRINT_KIND_DHASH
import app.tazala.scanner.core.ImageMetrics
import app.tazala.scanner.core.SimilarityGrouper
import app.tazala.scanner.core.SimilarityLevel

data class SimilarityResult(
  val groups: List<List<String>>,
  val duplicates: List<List<String>>,
  val comparisons: Long,
  val itemCount: Int,
)

object SimilarityStore {
  private const val QUERY = """
    SELECT an.asset_id, a.created_at, an.fingerprint_kind, an.fingerprint, an.exact_hash, a.width, a.height, an.blur_score
    FROM analysis an
    JOIN assets a ON a.id = an.asset_id
    WHERE an.status = 'ok' AND a.media_type = 'photo'
    ORDER BY a.created_at, an.asset_id
  """

  fun findGroups(databasePath: String, level: SimilarityLevel, windowMs: Long): SimilarityResult {
    val path = if (databasePath.startsWith("file://")) Uri.parse(databasePath).path ?: databasePath else databasePath
    val grouper = SimilarityGrouper(windowMs, level.dhashThreshold)
    val duplicateGrouper = DuplicateGrouper()
    val similarIdentifiers = ArrayList<String>()
    val duplicateIdentifiers = ArrayList<String>()
    SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READONLY).use { database ->
      database.rawQuery(QUERY, null).use { cursor ->
        while (cursor.moveToNext()) {
          val identifier = cursor.getString(0) ?: continue
          val hash = if (!cursor.isNull(3) && cursor.getString(2) == FINGERPRINT_KIND_DHASH) {
            ImageMetrics.decodeHash(cursor.getString(3))
          } else {
            null
          }
          if (hash != null) {
            similarIdentifiers.add(identifier)
            grouper.add(cursor.getLong(1), hash)
          }
          val signature = if (cursor.isNull(4)) null else ImageMetrics.decodeSignature(cursor.getString(4))
          if (signature != null) {
            duplicateIdentifiers.add(identifier)
            duplicateGrouper.add(cursor.getInt(5), cursor.getInt(6), signature, cursor.getDouble(7))
          }
        }
      }
    }
    return SimilarityResult(
      groups = grouper.groups().map { group -> group.map { similarIdentifiers[it] } },
      duplicates = duplicateGrouper.groups().map { group -> group.map { duplicateIdentifiers[it] } },
      comparisons = grouper.comparisons + duplicateGrouper.comparisons,
      itemCount = similarIdentifiers.size,
    )
  }
}
