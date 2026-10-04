// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "TazalaScannerCore",
  platforms: [.macOS(.v13), .iOS(.v16)],
  products: [
    .library(name: "TazalaScannerCore", targets: ["TazalaScannerCore"])
  ],
  targets: [
    .target(name: "TazalaScannerCore", path: "Core"),
    .testTarget(
      name: "TazalaScannerCoreTests",
      dependencies: ["TazalaScannerCore"],
      path: "Tests/TazalaScannerCoreTests"
    ),
  ]
)
