import Foundation
import SQLite3

enum SimilarityStoreError: Error, CustomStringConvertible {
  case open(String)
  case query(String)

  var description: String {
    switch self {
    case let .open(message): return "Cannot open analysis database: \(message)"
    case let .query(message): return "Cannot read analysis database: \(message)"
    }
  }
}

struct SimilarityResult {
  let groups: [[String]]
  let duplicates: [[String]]
  let comparisons: Int
  let itemCount: Int
}

enum SimilarityStore {
  static let query = """
    SELECT an.asset_id, a.created_at, an.fingerprint_kind, an.fingerprint, an.exact_hash, a.width, a.height, an.blur_score
    FROM analysis an
    JOIN assets a ON a.id = an.asset_id
    WHERE an.status = 'ok' AND a.media_type = 'photo'
    ORDER BY a.created_at, an.asset_id
    """

  static func findGroups(
    databasePath: String,
    level: SimilarityLevel,
    windowMs: Int64
  ) throws -> SimilarityResult {
    let path = databasePath.hasPrefix("file://")
      ? (URL(string: databasePath)?.path ?? databasePath)
      : databasePath

    var database: OpaquePointer?
    guard sqlite3_open_v2(path, &database, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, nil) == SQLITE_OK,
      let database
    else {
      let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
      sqlite3_close(database)
      throw SimilarityStoreError.open(message)
    }
    defer { sqlite3_close(database) }
    sqlite3_busy_timeout(database, 5_000)

    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw SimilarityStoreError.query(String(cString: sqlite3_errmsg(database)))
    }
    defer { sqlite3_finalize(statement) }

    var grouper = SimilarityGrouper(windowMs: windowMs, thresholds: .forLevel(level))
    var duplicateGrouper = DuplicateGrouper()
    var similarIdentifiers: [String] = []
    var duplicateIdentifiers: [String] = []

    while true {
      let step = sqlite3_step(statement)
      if step == SQLITE_DONE { break }
      guard step == SQLITE_ROW else {
        throw SimilarityStoreError.query(String(cString: sqlite3_errmsg(database)))
      }
      guard let idText = sqlite3_column_text(statement, 0) else { continue }
      let identifier = String(cString: idText)

      if let kindText = sqlite3_column_text(statement, 2),
        let fingerprintText = sqlite3_column_text(statement, 3),
        let fingerprint = Fingerprint(kind: String(cString: kindText), encoded: String(cString: fingerprintText))
      {
        similarIdentifiers.append(identifier)
        grouper.add(createdAt: sqlite3_column_int64(statement, 1), fingerprint: fingerprint)
      }

      if let signatureText = sqlite3_column_text(statement, 4),
        let signature = ImageMetrics.decodeSignature(String(cString: signatureText))
      {
        duplicateIdentifiers.append(identifier)
        duplicateGrouper.add(
          width: Int(sqlite3_column_int(statement, 5)),
          height: Int(sqlite3_column_int(statement, 6)),
          signature: signature,
          sharpness: sqlite3_column_double(statement, 7)
        )
      }
    }

    let groups = grouper.groups().map { $0.map { similarIdentifiers[$0] } }
    let duplicates = duplicateGrouper.groups().map { $0.map { duplicateIdentifiers[$0] } }
    return SimilarityResult(
      groups: groups,
      duplicates: duplicates,
      comparisons: grouper.comparisons + duplicateGrouper.comparisons,
      itemCount: similarIdentifiers.count
    )
  }
}
