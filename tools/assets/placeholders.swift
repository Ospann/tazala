import AppKit
import CoreGraphics
import CoreText
import Foundation

let teal = CGColor(red: 0.043, green: 0.49, blue: 0.439, alpha: 1)
let mint = CGColor(red: 0.902, green: 0.969, blue: 0.953, alpha: 1)
let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
let clear = CGColor(red: 0, green: 0, blue: 0, alpha: 0)

func render(_ size: Int, _ path: String, draw: (CGContext, CGFloat) -> Void) {
  let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  draw(context, CGFloat(size))
  let rep = NSBitmapImageRep(cgImage: context.makeImage()!)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

func text(_ context: CGContext, _ string: String, size: CGFloat, color: CGColor, center: CGPoint) {
  let font = CTFontCreateWithName("SFProRounded-Bold" as CFString, size, nil)
  let attributed = NSAttributedString(string: string, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ])
  let line = CTLineCreateWithAttributedString(attributed)
  let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
  context.textPosition = CGPoint(x: center.x - bounds.width / 2 - bounds.minX, y: center.y - bounds.height / 2 - bounds.minY)
  CTLineDraw(line, context)
}

let out = CommandLine.arguments[1]

render(1024, "\(out)/icon.png") { context, side in
  context.setFillColor(teal)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
  text(context, "T", size: side * 0.62, color: white, center: CGPoint(x: side / 2, y: side * 0.56))
  text(context, "Tazala", size: side * 0.12, color: mint, center: CGPoint(x: side / 2, y: side * 0.17))
}

render(1024, "\(out)/android-icon-background.png") { context, side in
  context.setFillColor(teal)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
}

render(1024, "\(out)/android-icon-foreground.png") { context, side in
  context.setFillColor(clear)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
  text(context, "T", size: side * 0.42, color: white, center: CGPoint(x: side / 2, y: side * 0.54))
  text(context, "Tazala", size: side * 0.08, color: mint, center: CGPoint(x: side / 2, y: side * 0.34))
}

render(1024, "\(out)/android-icon-monochrome.png") { context, side in
  context.setFillColor(clear)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
  text(context, "T", size: side * 0.42, color: white, center: CGPoint(x: side / 2, y: side * 0.5))
}

render(512, "\(out)/splash-icon.png") { context, side in
  context.setFillColor(clear)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
  context.setFillColor(teal)
  context.fillEllipse(in: CGRect(x: side * 0.1, y: side * 0.1, width: side * 0.8, height: side * 0.8))
  text(context, "T", size: side * 0.5, color: white, center: CGPoint(x: side / 2, y: side * 0.52))
}

render(196, "\(out)/favicon.png") { context, side in
  context.setFillColor(teal)
  context.fill(CGRect(x: 0, y: 0, width: side, height: side))
  text(context, "T", size: side * 0.7, color: white, center: CGPoint(x: side / 2, y: side * 0.5))
}
print("ok")
