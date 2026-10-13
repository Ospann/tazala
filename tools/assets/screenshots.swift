import AppKit

let width: CGFloat = 1320
let height: CGFloat = 2868

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
}

func sparkle(center: CGPoint, radius: CGFloat, fill: NSColor) {
  let path = NSBezierPath()
  let points = (0..<4).map { CGPoint(x: center.x + cos(CGFloat($0) * .pi / 2) * radius, y: center.y + sin(CGFloat($0) * .pi / 2) * radius) }
  path.move(to: points[0])
  for index in 0..<4 {
    let control = CGPoint(x: center.x + cos(CGFloat(index) * .pi / 2 + .pi / 4) * radius * 0.2,
                          y: center.y + sin(CGFloat(index) * .pi / 2 + .pi / 4) * radius * 0.2)
    path.curve(to: points[(index + 1) % 4], controlPoint1: control, controlPoint2: control)
  }
  path.close()
  fill.setFill()
  path.fill()
}

func background() {
  let gradient = NSGradient(starting: color(0x14BCA6), ending: color(0x06625A))!
  gradient.draw(in: NSRect(x: 0, y: 0, width: width, height: height), angle: -70)
  let glow = NSGradient(starting: color(0xFFFFFF, 0.22), ending: color(0xFFFFFF, 0))!
  glow.draw(fromCenter: CGPoint(x: width * 0.2, y: height * 0.92), radius: 0, toCenter: CGPoint(x: width * 0.2, y: height * 0.92), radius: 900, options: [])
}

func caption(_ text: String) {
  let style = NSMutableParagraphStyle()
  style.alignment = .center
  style.lineSpacing = 6
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 92, weight: .heavy),
    .foregroundColor: NSColor.white,
    .paragraphStyle: style,
  ]
  let rect = NSRect(x: 90, y: height - 560, width: width - 180, height: 420)
  (text as NSString).draw(with: rect, options: [.usesLineFragmentOrigin], attributes: attributes)
}

func render(_ path: String, _ draw: () -> Void) {
  let context = CGContext(data: nil, width: Int(width), height: Int(height), bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  draw()
  NSGraphicsContext.restoreGraphicsState()
  let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(destination, context.makeImage()!, nil)
  CGImageDestinationFinalize(destination)
}

func phoneShot(source: String, caption text: String, output: String) {
  let screen = NSImage(contentsOfFile: source)!
  let pixel = screen.representations.first!
  let sourceWidth = CGFloat(pixel.pixelsWide), sourceHeight = CGFloat(pixel.pixelsHigh)
  let cropTop: CGFloat = 96
  let crop = NSRect(x: 0, y: 0, width: sourceWidth, height: sourceHeight - cropTop)
  render(output) {
  background()
  caption(text)
  let frameWidth: CGFloat = 1060
  let scale = frameWidth / sourceWidth
  let frameHeight = crop.height * scale
  let frame = NSRect(x: (width - frameWidth) / 2, y: height - 640 - frameHeight, width: frameWidth, height: frameHeight)
  let shadow = NSShadow()
  shadow.shadowColor = color(0x022622, 0.45)
  shadow.shadowBlurRadius = 60
  shadow.shadowOffset = NSSize(width: 0, height: -24)
  NSGraphicsContext.saveGraphicsState()
  shadow.set()
  color(0x0B1F1C).setFill()
  NSBezierPath(roundedRect: frame.insetBy(dx: -18, dy: -18), xRadius: 92, yRadius: 92).fill()
  NSGraphicsContext.restoreGraphicsState()
  NSGraphicsContext.saveGraphicsState()
  NSBezierPath(roundedRect: frame, xRadius: 76, yRadius: 76).addClip()
  screen.draw(in: frame, from: NSRect(x: 0, y: 0, width: screen.size.width, height: screen.size.height * crop.height / sourceHeight), operation: .copy, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  sparkle(center: CGPoint(x: width - 150, y: height - 150), radius: 60, fill: NSColor.white)
  sparkle(center: CGPoint(x: 140, y: height - 610), radius: 34, fill: color(0xFFB4A8))
  }
}

func privacyShot(source: String, caption text: String, subtitle: String, output: String) {
  let screen = NSImage(contentsOfFile: source)!
  let pixel = screen.representations.first!
  let sourceWidth = CGFloat(pixel.pixelsWide), sourceHeight = CGFloat(pixel.pixelsHigh)
  render(output) {
  background()
  caption(text)
  let disc = NSRect(x: (width - 980) / 2, y: 900, width: 980, height: 980)
  color(0xF5FAF9).setFill()
  NSBezierPath(ovalIn: disc).fill()
  let cropPixels = NSRect(x: 360, y: sourceHeight - 1460, width: 720, height: 720)
  let ratio = screen.size.width / sourceWidth
  let crop = NSRect(x: cropPixels.minX * ratio, y: cropPixels.minY * ratio, width: cropPixels.width * ratio, height: cropPixels.height * ratio)
  NSGraphicsContext.saveGraphicsState()
  NSBezierPath(ovalIn: disc.insetBy(dx: 6, dy: 6)).addClip()
  screen.draw(in: disc.insetBy(dx: 70, dy: 70), from: crop, operation: .sourceOver, fraction: 1)
  NSGraphicsContext.restoreGraphicsState()
  sparkle(center: CGPoint(x: width - 230, y: 1830), radius: 70, fill: NSColor.white)
  sparkle(center: CGPoint(x: 210, y: 1020), radius: 42, fill: color(0xFFB4A8))
  sparkle(center: CGPoint(x: width - 190, y: 980), radius: 30, fill: color(0xD3F1EC))
  let style = NSMutableParagraphStyle()
  style.alignment = .center
  style.lineSpacing = 8
  (subtitle as NSString).draw(with: NSRect(x: 120, y: 420, width: width - 240, height: 360), options: [.usesLineFragmentOrigin], attributes: [
    .font: NSFont.systemFont(ofSize: 56, weight: .semibold),
    .foregroundColor: color(0xE6FFFA),
    .paragraphStyle: style,
  ])
  }
}

let shots = CommandLine.arguments[1]
let out = CommandLine.arguments[2]
let captions: [String: [String]] = [
  "ru": ["Освободите место\nза пару минут", "Оставляем лучший\nкадр из серии", "Разбирайте галерею\nсвайпами", "Ничего не удаляется\nбез подтверждения", "Фото не покидают\nтелефон"],
  "en": ["Free up space\nin minutes", "Keep the best shot\nof every series", "Review your gallery\nwith swipes", "Nothing is deleted\nwithout your OK", "Your photos never\nleave your phone"],
]
let subtitles = [
  "ru": "Весь анализ — на устройстве. Без интернета, аккаунтов, рекламы и трекинга.",
  "en": "All analysis happens on device. No internet, accounts, ads or tracking.",
]
let names = ["1-dashboard", "2-similar", "3-swipe", "4-trash"]
for language in ["ru", "en"] {
  for (index, name) in names.enumerated() {
    phoneShot(source: "\(shots)/\(language)-\(name).png", caption: captions[language]![index], output: "\(out)/\(language)-\(index + 1).png")
  }
  privacyShot(source: "\(shots)/en-5-privacy.png", caption: captions[language]![4], subtitle: subtitles[language]!, output: "\(out)/\(language)-5.png")
}
print("ok")
